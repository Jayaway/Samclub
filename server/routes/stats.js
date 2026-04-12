import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 平台收益统计
router.get('/platform', (req, res) => {
  try {
    // 全部尾差收益
    const total = db.prepare(`
      SELECT COALESCE(SUM(diff_cents), 0) as total_cents
      FROM platform_revenue
    `).get();

    // 按月统计
    const byMonth = db.prepare(`
      SELECT
        strftime('%Y-%m', pr.recorded_at) as month,
        COUNT(*) as group_count,
        SUM(pr.diff_cents) as total_cents
      FROM platform_revenue pr
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all();

    // 按拼单详情（最近20条）
    const byGroup = db.prepare(`
      SELECT
        pr.group_buy_id,
        pr.diff_cents,
        pr.recorded_at,
        gb.title,
        gb.status,
        gb.total_amount
      FROM platform_revenue pr
      JOIN group_buys gb ON gb.id = pr.group_buy_id
      ORDER BY pr.recorded_at DESC
      LIMIT 20
    `).all();

    res.json({
      total_cents: total.total_cents,
      total_yuan: (total.total_cents / 100).toFixed(2),
      by_month: byMonth.map(row => ({
        ...row,
        total_yuan: (row.total_cents / 100).toFixed(2)
      })),
      recent: byGroup.map(row => ({
        ...row,
        diff_yuan: (row.diff_cents / 100).toFixed(2)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
