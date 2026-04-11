import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 更新支付状态
router.put('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { paid_status } = req.body;

    db.prepare('UPDATE cost_details SET paid_status = ? WHERE id = ?').run(paid_status, id);

    const detail = db.prepare(`
      SELECT cd.*, u.nickname as user_name
      FROM cost_details cd
      JOIN users u ON cd.user_id = u.id
      WHERE cd.id = ?
    `).get(id);

    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
