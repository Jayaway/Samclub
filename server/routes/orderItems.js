import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 添加/更新订单项
router.post('/', (req, res) => {
  try {
    const { group_buy_id, user_id, product_id, quantity } = req.body;

    if (!group_buy_id || !user_id || !product_id || !quantity) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 获取商品信息
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    if (quantity > product.remaining_quantity) {
      return res.status(400).json({ error: '库存不足' });
    }

    // 计算小计
    const subtotal = quantity * product.unit_price;

    // 检查是否已有订单
    const existing = db.prepare(`
      SELECT * FROM order_items
      WHERE group_buy_id = ? AND user_id = ? AND product_id = ?
    `).get(group_buy_id, user_id, product_id);

    let orderItem;
    if (existing) {
      // 更新数量
      const diff = quantity - existing.quantity;
      if (diff === 0) {
        return res.json(existing);
      }

      // 检查库存
      if (diff > 0 && diff > product.remaining_quantity) {
        return res.status(400).json({ error: '库存不足' });
      }

      db.prepare(`
        UPDATE order_items SET quantity = ?, subtotal = ? WHERE id = ?
      `).run(quantity, subtotal, existing.id);

      // 更新商品库存
      db.prepare(`
        UPDATE products SET remaining_quantity = remaining_quantity - ? WHERE id = ?
      `).run(diff, product_id);

      orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(existing.id);
    } else {
      // 新增订单
      const stmt = db.prepare(`
        INSERT INTO order_items (group_buy_id, user_id, product_id, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(group_buy_id, user_id, product_id, quantity, subtotal);
      orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(result.lastInsertRowid);

      // 更新商品库存
      db.prepare(`
        UPDATE products SET remaining_quantity = remaining_quantity - ? WHERE id = ?
      `).run(quantity, product_id);
    }

    // 更新拼单总金额
    updateGroupBuyTotal(group_buy_id);

    res.json(orderItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的订单项
router.get('/user/:userId/group/:groupBuyId', (req, res) => {
  try {
    const { userId, groupBuyId } = req.params;

    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.unit_price, p.is_split_allowed
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.user_id = ? AND oi.group_buy_id = ?
    `).all(userId, groupBuyId);

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除订单项
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: '订单项不存在' });
    }

    // 恢复库存
    db.prepare(`
      UPDATE products SET remaining_quantity = remaining_quantity + ? WHERE id = ?
    `).run(item.quantity, item.product_id);

    db.prepare('DELETE FROM order_items WHERE id = ?').run(id);

    // 更新拼单总金额
    updateGroupBuyTotal(item.group_buy_id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新拼单总金额
function updateGroupBuyTotal(groupBuyId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE group_buy_id = ?
  `).get(groupBuyId);

  db.prepare('UPDATE group_buys SET total_amount = ? WHERE id = ?')
    .run(result.total, groupBuyId);
}

export default router;
