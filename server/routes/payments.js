import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 上传付款凭证
router.post('/', (req, res) => {
  try {
    const { group_buy_id, user_id, amount, proof_image } = req.body;

    if (!group_buy_id || !user_id || !amount) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 检查是否已有付款记录
    const existing = db.prepare(`
      SELECT * FROM payments WHERE group_buy_id = ? AND user_id = ?
    `).get(group_buy_id, user_id);

    let payment;
    if (existing) {
      db.prepare(`
        UPDATE payments SET amount = ?, proof_image = ?, status = '待确认'
        WHERE group_buy_id = ? AND user_id = ?
      `).run(amount, proof_image || '', group_buy_id, user_id);
      payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(existing.id);
    } else {
      const stmt = db.prepare(`
        INSERT INTO payments (group_buy_id, user_id, amount, proof_image, status)
        VALUES (?, ?, ?, ?, '待确认')
      `);
      const result = stmt.run(group_buy_id, user_id, amount, proof_image || '');
      payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
    }

    // 更新费用详情支付状态
    db.prepare(`
      UPDATE cost_details SET paid_status = '待确认'
      WHERE group_buy_id = ? AND user_id = ?
    `).run(group_buy_id, user_id);

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 团长确认付款
router.put('/:id/confirm', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // '已确认' 或 '已拒绝'

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      return res.status(404).json({ error: '付款记录不存在' });
    }

    db.prepare(`
      UPDATE payments SET status = ?, confirm_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);

    // 更新费用详情
    db.prepare(`
      UPDATE cost_details SET paid_status = ?
      WHERE group_buy_id = ? AND user_id = ?
    `).run(status, payment.group_buy_id, payment.user_id);

    const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量确认付款
router.post('/batch-confirm', (req, res) => {
  try {
    const { payment_ids, status } = req.body;

    if (!payment_ids || !Array.isArray(payment_ids)) {
      return res.status(400).json({ error: 'payment_ids 必须是数组' });
    }

    const updateStmt = db.prepare(`
      UPDATE payments SET status = ?, confirm_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const updateCostStmt = db.prepare(`
      UPDATE cost_details SET paid_status = ?
      WHERE group_buy_id = ? AND user_id = ?
    `);

    const results = [];
    payment_ids.forEach(id => {
      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
      if (payment) {
        updateStmt.run(status, id);
        updateCostStmt.run(status, payment.group_buy_id, payment.user_id);
        results.push(payment);
      }
    });

    res.json({ success: true, updated: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的付款记录
router.get('/', (req, res) => {
  try {
    const { user_id, group_buy_id } = req.query;

    if (!user_id || !group_buy_id) {
      return res.status(400).json({ error: 'user_id 和 group_buy_id 必填' });
    }

    const payments = db.prepare(`
      SELECT p.*, u.nickname as user_name, u.avatar as user_avatar
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.group_buy_id = ?
    `).all(user_id, group_buy_id);

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取拼单的付款记录（团长用）
router.get('/group/:groupBuyId', (req, res) => {
  try {
    const { groupBuyId } = req.params;

    const payments = db.prepare(`
      SELECT p.*, u.nickname as user_name, u.avatar as user_avatar
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.group_buy_id = ?
    `).all(groupBuyId);

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
