import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 注册
router.post('/register', (req, res) => {
  try {
    const { student_id, nickname, dorm_building } = req.body;

    if (!student_id || !nickname) {
      return res.status(400).json({ error: '学号和昵称必填' });
    }

    // 学号格式校验：B/F + 8位数字
    if (!/^(B|F)\d{8}$/.test(student_id)) {
      return res.status(400).json({ error: '学号格式：B/F + 8位数字（如 B25011215）' });
    }

    // 检查是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE student_id = ?').get(student_id);
    if (existing) {
      return res.status(400).json({ error: '该学号已注册' });
    }

    const stmt = db.prepare(`
      INSERT INTO users (student_id, nickname, dorm_building)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(student_id, nickname, dorm_building || '');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 登录 (学号验证)
router.post('/login', (req, res) => {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: '学号必填' });
    }

    const user = db.prepare('SELECT * FROM users WHERE student_id = ?')
      .get(student_id);

    if (!user) {
      return res.status(401).json({ error: '学号不存在' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取当前用户
router.get('/me', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新用户信息
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, avatar, dorm_building, payment_qr } = req.body;

    const stmt = db.prepare(`
      UPDATE users SET nickname = COALESCE(?, nickname),
      avatar = COALESCE(?, avatar),
      dorm_building = COALESCE(?, dorm_building),
      payment_qr = COALESCE(?, payment_qr)
      WHERE id = ?
    `);

    stmt.run(nickname, avatar, dorm_building, payment_qr, id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
