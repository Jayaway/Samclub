import { Router } from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// 添加/更新订单项
// purchase_type: 'whole' | 'split'，默认 'whole'
router.post('/', auth, (req, res) => {
  try {
    const { group_buy_id, product_id, quantity, purchase_type } = req.body;
    const user_id = req.user.userId;

    if (!group_buy_id || !product_id || !quantity) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 校验拼单状态为"拼单中"
    const gb = db.prepare('SELECT status FROM group_buys WHERE id = ?').get(group_buy_id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }
    if (gb.status !== '拼单中') {
      return res.status(400).json({ error: '当前拼单状态不允许下单' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const isSplit = purchase_type === 'split' && product.allow_split;
    const purchaseType = isSplit ? 'split' : 'whole';

    // 检查是否已有订单
    const existing = db.prepare(`
      SELECT * FROM order_items
      WHERE group_buy_id = ? AND user_id = ? AND product_id = ?
    `).get(group_buy_id, user_id, product_id);

    let orderItem;

    if (existing) {
      const diff = quantity - existing.quantity;
      if (diff === 0) {
        return res.json(existing);
      }

      // 处理 purchase_type 变更时的库存切换
      if (existing.purchase_type !== purchaseType) {
        // 先归还旧类型库存
        const oldStockField = (existing.purchase_type === 'split') ? 'split_remaining_quantity' : 'remaining_quantity';
        db.prepare(`
          UPDATE products SET ${oldStockField} = ${oldStockField} + ? WHERE id = ?
        `).run(existing.quantity, product_id);

        // 再扣减新类型库存
        const newStockField = (purchaseType === 'split') ? 'split_remaining_quantity' : 'remaining_quantity';
        const result = db.prepare(`
          UPDATE products SET ${newStockField} = ${newStockField} - ?
          WHERE id = ? AND ${newStockField} >= ?
        `).run(quantity, product_id, quantity);

        if (result.changes === 0) {
          // 回滚旧类型库存归还
          db.prepare(`
            UPDATE products SET ${oldStockField} = ${oldStockField} - ? WHERE id = ?
          `).run(existing.quantity, product_id);
          return res.status(400).json({ error: '库存不足' });
        }
      } else if (diff > 0) {
        // 加购：原子扣减库存
        const stockField = (purchaseType === 'split') ? 'split_remaining_quantity' : 'remaining_quantity';
        const result = db.prepare(`
          UPDATE products SET ${stockField} = ${stockField} - ?
          WHERE id = ? AND ${stockField} >= ?
        `).run(diff, product_id, diff);

        if (result.changes === 0) {
          return res.status(400).json({ error: '库存不足' });
        }
      } else {
        // 减购：归还库存
        const stockField = (purchaseType === 'split') ? 'split_remaining_quantity' : 'remaining_quantity';
        db.prepare(`
          UPDATE products SET ${stockField} = ${stockField} + ? WHERE id = ?
        `).run(-diff, product_id);
      }

      // 更新订单
      const subtotal = purchaseType === 'split'
        ? product.split_price_per_unit * quantity
        : quantity * product.unit_price;

      db.prepare(`
        UPDATE order_items SET quantity = ?, subtotal = ?, purchase_type = ?
        WHERE id = ?
      `).run(quantity, subtotal, purchaseType, existing.id);

      orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(existing.id);
    } else {
      // 新增订单
      if (isSplit) {
        const result = db.prepare(`
          UPDATE products SET split_remaining_quantity = split_remaining_quantity - ?
          WHERE id = ? AND split_remaining_quantity >= ?
        `).run(quantity, product_id, quantity);

        if (result.changes === 0) {
          return res.status(400).json({ error: '库存不足' });
        }

        const subtotal = product.split_price_per_unit * quantity;
        const r = db.prepare(`
          INSERT INTO order_items (group_buy_id, user_id, product_id, quantity, subtotal, purchase_type)
          VALUES (?, ?, ?, ?, ?, 'split')
        `).run(group_buy_id, user_id, product_id, quantity, subtotal);
        orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(r.lastInsertRowid);
      } else {
        const result = db.prepare(`
          UPDATE products SET remaining_quantity = remaining_quantity - ?
          WHERE id = ? AND remaining_quantity >= ?
        `).run(quantity, product_id, quantity);

        if (result.changes === 0) {
          return res.status(400).json({ error: '库存不足' });
        }

        const subtotal = quantity * product.unit_price;
        const r = db.prepare(`
          INSERT INTO order_items (group_buy_id, user_id, product_id, quantity, subtotal, purchase_type)
          VALUES (?, ?, ?, ?, ?, 'whole')
        `).run(group_buy_id, user_id, product_id, quantity, subtotal);
        orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(r.lastInsertRowid);
      }
    }

    updateGroupBuyTotal(group_buy_id);
    res.json(orderItem);
  } catch (error) {
    console.error('Create/update order item error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取用户的订单项
router.get('/user/:userId/group/:groupBuyId', (req, res) => {
  try {
    const { userId, groupBuyId } = req.params;

    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.unit_price, p.allow_split,
             p.split_remaining_quantity, p.split_unit, p.split_quantity_per_whole,
             p.split_price_per_unit
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.user_id = ? AND oi.group_buy_id = ?
    `).all(userId, groupBuyId);

    res.json(items);
  } catch (error) {
    console.error('Get order items error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除订单项
router.delete('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: '订单项不存在' });
    }

    // 归还库存
    if (item.purchase_type === 'split') {
      db.prepare(`
        UPDATE products SET split_remaining_quantity = split_remaining_quantity + ?
        WHERE id = ?
      `).run(item.quantity, item.product_id);
    } else {
      db.prepare(`
        UPDATE products SET remaining_quantity = remaining_quantity + ?
        WHERE id = ?
      `).run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM order_items WHERE id = ?').run(id);

    // 更新拼单总金额
    updateGroupBuyTotal(item.group_buy_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete order item error:', error);
    res.status(500).json({ error: '服务器内部错误' });
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
