import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 添加商品
router.post('/', (req, res) => {
  try {
    const { group_buy_id, name, original_price, total_quantity, is_split_allowed, is_frozen, unit_price } = req.body;

    if (!group_buy_id || !name || !original_price || !total_quantity) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const stmt = db.prepare(`
      INSERT INTO products (group_buy_id, name, original_price, total_quantity, remaining_quantity, is_split_allowed, is_frozen, unit_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      group_buy_id,
      name,
      original_price,
      total_quantity,
      total_quantity,
      is_split_allowed ? 1 : 0,
      is_frozen ? 1 : 0,
      unit_price || original_price
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
    const { name, original_price, total_quantity, remaining_quantity, is_split_allowed, unit_price } = req.body;

    const stmt = db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        original_price = COALESCE(?, original_price),
        total_quantity = COALESCE(?, total_quantity),
        remaining_quantity = COALESCE(?, remaining_quantity),
        is_split_allowed = COALESCE(?, is_split_allowed),
        unit_price = COALESCE(?, unit_price)
      WHERE id = ?
    `);

    stmt.run(name, original_price, total_quantity, remaining_quantity,
      is_split_allowed !== undefined ? (is_split_allowed ? 1 : 0) : null,
      unit_price, id);

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
