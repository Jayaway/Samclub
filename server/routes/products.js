import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 添加商品
// product_type: 'fixed'(固定商品) | 'custom'(自定义商品)
// fixed 商品支持拆分，custom 商品不支持拆分
router.post('/', (req, res) => {
  try {
    const { group_buy_id, name, original_price, quantity, product_type, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, needs_cold_chain, unit_price } = req.body;

    if (!group_buy_id || !name || !original_price || !quantity) {
      return res.status(400).json({ error: '缺少必填字段' });
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
    res.status(500).json({ error: error.message });
  }
});

// 更新商品
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, original_price, quantity, remaining_quantity, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, unit_price } = req.body;

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

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除商品
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM order_items WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
