import { Router } from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// 更新支付状态
router.put('/:id/status', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { paid_status } = req.body;

    // paid_status 白名单校验
    const VALID_STATUSES = ['未付', '待确认', '已确认', '已拒绝'];
    if (!VALID_STATUSES.includes(paid_status)) {
      return res.status(400).json({ error: `无效的支付状态，允许值: ${VALID_STATUSES.join('、')}` });
    }

    db.prepare('UPDATE cost_details SET paid_status = ? WHERE id = ?').run(paid_status, id);

    const detail = db.prepare(`
      SELECT cd.*, u.nickname as user_name
      FROM cost_details cd
      JOIN users u ON cd.user_id = u.id
      WHERE cd.id = ?
    `).get(id);

    res.json(detail);
  } catch (error) {
    console.error('Update cost detail status error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
