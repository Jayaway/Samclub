import { Router } from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// 添加商品
// product_type: 'fixed'(固定商品) | 'custom'(自定义商品)
// fixed 商品支持拆分，custom 商品不支持拆分
router.post('/', auth, (req, res) => {
  try {
    const { group_buy_id, name, original_price, quantity, product_type, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, needs_cold_chain, unit_price } = req.body;

    if (!group_buy_id || !name || !original_price || !quantity) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 验证请求者是拼单的团长
    const gb = db.prepare('SELECT creator_id, status FROM group_buys WHERE id = ?').get(group_buy_id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }
    if (req.user.userId !== gb.creator_id) {
      return res.status(403).json({ error: '只有团长才能添加商品' });
    }

    const type = product_type || 'fixed';
    const isFixed = type === 'fixed';

    // 自定义商品不允许拆分
    if (!isFixed) {
      if (allow_split) {
        return res.status(400).json({ error: '自定义商品不支持拆分' });
      }
    }

    // 固定商品拆分校验
    if (isFixed && allow_split && split_price_per_unit !== undefined && split_quantity_per_whole) {
      const maxUnitPrice = original_price / split_quantity_per_whole;
      if (split_price_per_unit > maxUnitPrice) {
        return res.status(400).json({
          error: `拆分单价不能高于整份均摊单价¥${maxUnitPrice.toFixed(2)}（每份${split_quantity_per_whole}个，单价上限¥${(maxUnitPrice).toFixed(2)}）`
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO products (group_buy_id, product_type, name, original_price, quantity, remaining_quantity, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, needs_cold_chain, unit_price, split_remaining_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 可售拆分单位数：仅固定商品且允许拆分时计算
    const splitRemaining = (isFixed && allow_split && split_quantity_per_whole)
      ? (quantity * split_quantity_per_whole) - (self_retain_quantity || 0)
      : null;

    const result = stmt.run(
      group_buy_id,
      type,
      name,
      original_price,
      quantity,
      quantity,
      isFixed ? (allow_split ? 1 : 0) : 0,
      isFixed ? (split_unit || null) : null,
      isFixed ? (split_quantity_per_whole || null) : null,
      isFixed ? (split_price_per_unit || null) : null,
      isFixed ? (self_retain_quantity || 0) : 0,
      needs_cold_chain ? 1 : 0,
      unit_price || original_price,
      splitRemaining
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新商品
router.put('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, original_price, quantity, remaining_quantity, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, unit_price } = req.body;

    // 验证拼单状态为"拼单中"
    const product = db.prepare(`
      SELECT p.*, gb.status as group_status, gb.creator_id
      FROM products p
      JOIN group_buys gb ON p.group_buy_id = gb.id
      WHERE p.id = ?
    `).get(id);

    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    if (product.group_status !== '拼单中') {
      return res.status(400).json({ error: '当前拼单状态不允许修改商品' });
    }

    // 拆分单价校验
    if (allow_split && split_price_per_unit !== undefined && split_quantity_per_whole) {
      const maxUnitPrice = (original_price || 0 ) / split_quantity_per_whole;
      if (split_price_per_unit > maxUnitPrice) {
        return res.status(400).json({
          error: `拆分单价不能高于整份均摊单价¥${maxUnitPrice.toFixed(2)}`
        });
      }
    }

    const stmt = db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        original_price = COALESCE(?, original_price),
        quantity = COALESCE(?, quantity),
        remaining_quantity = COALESCE(?, remaining_quantity),
        allow_split = COALESCE(?, allow_split),
        split_unit = COALESCE(?, split_unit),
        split_quantity_per_whole = COALESCE(?, split_quantity_per_whole),
        split_price_per_unit = COALESCE(?, split_price_per_unit),
        self_retain_quantity = COALESCE(?, self_retain_quantity),
        unit_price = COALESCE(?, unit_price)
      WHERE id = ?
    `);

    stmt.run(
      name,
      original_price,
      quantity,
      remaining_quantity,
      allow_split !== undefined ? (allow_split ? 1 : 0) : null,
      split_unit,
      split_quantity_per_whole,
      split_price_per_unit,
      self_retain_quantity,
      unit_price,
      id
    );

    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除商品
router.delete('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    // 使用事务包裹删除操作
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM order_items WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    });

    deleteTransaction();

    // 触发费用重算
    const groupBuyId = product.group_buy_id;
    const totalAmount = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE group_buy_id = ?
    `).get(groupBuyId).total;

    db.prepare('UPDATE group_buys SET total_amount = ? WHERE id = ?')
      .run(totalAmount, groupBuyId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
