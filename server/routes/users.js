import { Router } from 'express';
import db from '../db.js';
import { auth, generateToken } from '../middleware/auth.js';
import { sendVerificationCode, verifyCode } from '../utils/sms.js';

const router = Router();

// 发送验证码
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: '手机号必填' });
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    const result = await sendVerificationCode(phone);
    
    if (result.success) {
      const response = { success: true, message: result.message };
      if (result.code) {
        response.code = result.code; // 仅开发模式有此字段
      }
      res.json(response);
    } else {
      res.status(429).json({ error: result.message });
    }
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { student_id, nickname, dorm_building, phone, avatar, code } = req.body;

    if (!student_id || !nickname) {
      return res.status(400).json({ error: '学号和昵称必填' });
    }

    // 学号格式校验
    if (!/^(b|B|f|F)\d{8}$/.test(student_id)) {
      return res.status(400).json({ error: '学号格式：B/F + 8位数字（如 B25011215）' });
    }

    if (nickname.length > 20) {
      return res.status(400).json({ error: '昵称长度不能超过20个字符' });
    }

    if (dorm_building && dorm_building.length > 50) {
      return res.status(400).json({ error: '宿舍楼信息不能超过50个字符' });
    }

    // 手机号选填，但如果填了需要验证码
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }
      if (!code) {
        return res.status(400).json({ error: '填写手机号需要验证码验证' });
      }
      const codeResult = verifyCode(phone, code);
      if (!codeResult.valid) {
        return res.status(400).json({ error: codeResult.message });
      }
    }

    // 检查学号是否已存在
    const existingStudent = db.prepare('SELECT id FROM users WHERE student_id = ?').get(student_id);
    if (existingStudent) {
      return res.status(400).json({ error: '该学号已注册，请直接登录' });
    }

    // 检查手机号是否已存在
    if (phone) {
      const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (existingPhone) {
        return res.status(400).json({ error: '该手机号已被其他账号使用' });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO users (student_id, nickname, dorm_building, phone, avatar)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(student_id, nickname, dorm_building || '', phone || null, avatar || null);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);
    res.json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录（学号直接登录，无需验证码）
router.post('/login', async (req, res) => {
  try {
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: '请输入学号' });
    }

    const user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);

    if (!user) {
      return res.status(401).json({ error: '学号不存在，请先注册' });
    }

    const token = generateToken(user);
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取当前用户
router.get('/me', auth, (req, res) => {
  try {
    const userId = req.user.userId;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新用户信息
router.put('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.userId !== Number(id)) {
      return res.status(403).json({ error: '只能修改自己的信息' });
    }

    const { nickname, avatar, dorm_building, payment_qr, phone, code } = req.body;

    // 如果要更新手机号，需要验证码
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }
      if (!code) {
        return res.status(400).json({ error: '更换手机号需要验证码' });
      }
      const codeResult = verifyCode(phone, code);
      if (!codeResult.valid) {
        return res.status(400).json({ error: codeResult.message });
      }
      const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, id);
      if (existing) {
        return res.status(400).json({ error: '该手机号已被其他账号使用' });
      }
    }

    const stmt = db.prepare(`
      UPDATE users SET 
        nickname = COALESCE(?, nickname),
        avatar = COALESCE(?, avatar),
        dorm_building = COALESCE(?, dorm_building),
        payment_qr = COALESCE(?, payment_qr),
        phone = COALESCE(?, phone)
      WHERE id = ?
    `);

    stmt.run(nickname, avatar, dorm_building, payment_qr, phone, id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
