import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// 平台收益统计（仅管理员可访问）
router.get('/platform', requireAdmin, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

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

    // 按拼单详情（分页）
    const allByGroup = db.prepare(`
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
    `).all();

    const totalCount = allByGroup.length;
    const byGroup = allByGroup.slice(offset, offset + limit);

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
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
