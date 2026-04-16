import jwt from 'jsonwebtoken';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_JWT_SECRET_HERE';

/**
 * 签发JWT令牌
 * @param {Object} user - 用户对象，需包含 id 和 student_id
 * @returns {string} JWT令牌
 */
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, studentId: user.student_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * JWT认证中间件 - 强制验证
 * 从 Authorization header 提取 Bearer token，验证并挂载 req.user
 */
export function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录，请提供有效的认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}

/**
 * 可选认证中间件 - 不强制
 * 有token时验证并挂载 req.user，无token时 req.user = null
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // token无效时视为未登录
    req.user = null;
    next();
  }
}

/**
 * 团长权限中间件
 * 检查当前用户是否是拼单的创建者
 * 需要在 auth 中间件之后使用
 * 期望 req.params.id 为拼单ID
 */
export function requireCreator(req, res, next) {
  try {
    const groupBuyId = req.params.id;
    const gb = db.prepare('SELECT creator_id FROM group_buys WHERE id = ?').get(groupBuyId);

    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    if (req.user.userId !== gb.creator_id) {
      return res.status(403).json({ error: '只有团长才能执行此操作' });
    }

    next();
  } catch (error) {
    console.error('requireCreator middleware error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}

/**
 * 管理员权限中间件
 * 检查当前用户是否在管理员列表中
 * 管理员ID从环境变量 ADMIN_USER_IDS 逗号分隔读取
 */
export function requireAdmin(req, res, next) {
  try {
    const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));

    if (!adminIds.includes(req.user.userId)) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    next();
  } catch (error) {
    console.error('requireAdmin middleware error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
