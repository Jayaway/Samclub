import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 获取拼单留言板消息
router.get('/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;

    const messages = db.prepare(`
      SELECT m.*, u.nickname as user_name, u.avatar as user_avatar
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.group_buy_id = ?
      ORDER BY m.created_at ASC
    `).all(groupId);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 发送留言
router.post('/', (req, res) => {
  try {
    const { group_buy_id, user_id, content } = req.body;

    if (!group_buy_id || !user_id || !content) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ error: '留言内容不能为空' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: '留言内容不能超过500字' });
    }

    // 检查拼单是否存在
    const gb = db.prepare('SELECT id FROM group_buys WHERE id = ?').get(group_buy_id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    // 检查用户是否参与该拼单（团长或已下单成员）
    const isMember = db.prepare(`
      SELECT 1 FROM order_items WHERE group_buy_id = ? AND user_id = ?
    `).get(group_buy_id, user_id);

    const isCreator = db.prepare(`
      SELECT 1 FROM group_buys WHERE id = ? AND creator_id = ?
    `).get(group_buy_id, user_id);

    if (!isMember && !isCreator) {
      return res.status(403).json({ error: '只有拼单成员才能留言' });
    }

    const stmt = db.prepare(`
      INSERT INTO messages (group_buy_id, user_id, content)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(group_buy_id, user_id, content.trim());

    const message = db.prepare(`
      SELECT m.*, u.nickname as user_name, u.avatar as user_avatar
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
