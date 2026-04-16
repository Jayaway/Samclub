import { Router } from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// 上传付款凭证
router.post('/', auth, (req, res) => {
  try {
    const { group_buy_id, amount, proof_image } = req.body;
    const user_id = req.user.userId;

    if (!group_buy_id || !amount) {
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
    console.error('Upload payment proof error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 团长确认付款
router.put('/:id/confirm', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // '已确认' 或 '已拒绝'

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      return res.status(404).json({ error: '付款记录不存在' });
    }

    // 验证操作者是拼单的团长
    const gb = db.prepare('SELECT creator_id FROM group_buys WHERE id = ?').get(payment.group_buy_id);
    if (!gb || req.user.userId !== gb.creator_id) {
      return res.status(403).json({ error: '只有团长才能确认付款' });
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
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 批量确认付款
router.post('/batch-confirm', auth, (req, res) => {
  try {
    const { payment_ids, status } = req.body;

    if (!payment_ids || !Array.isArray(payment_ids)) {
      return res.status(400).json({ error: 'payment_ids 必须是数组' });
    }

    // 限制最多50条
    if (payment_ids.length > 50) {
      return res.status(400).json({ error: '单次批量操作最多50条' });
    }

    // 状态白名单校验
    const VALID_STATUSES = ['已确认', '已拒绝'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `状态值无效，允许值: ${VALID_STATUSES.join('、')}` });
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
    console.error('Batch confirm payment error:', error);
    res.status(500).json({ error: '服务器内部错误' });
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
    console.error('Get payments error:', error);
    res.status(500).json({ error: '服务器内部错误' });
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
    console.error('Get group payments error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
