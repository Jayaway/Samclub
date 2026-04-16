import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import usersRouter from './routes/users.js';
import groupBuysRouter from './routes/groupBuys.js';
import productsRouter from './routes/products.js';
import orderItemsRouter from './routes/orderItems.js';
import paymentsRouter from './routes/payments.js';
import costDetailsRouter from './routes/costDetails.js';
import messagesRouter from './routes/messages.js';
import statsRouter from './routes/stats.js';
import alipayRouter from './routes/alipay.js';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 100;

// 安全中间件
app.use(helmet());

// 全局速率限制：每15分钟最多100个请求
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// 登录注册更严格的速率限制：每15分钟最多10次
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录/注册请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/users', usersRouter);
app.use('/api/group-buys', groupBuysRouter);
app.use('/api/products', productsRouter);
app.use('/api/order-items', orderItemsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/cost-details', costDetailsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/alipay', alipayRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// ==========================================
// 定时任务：自动完成"已送达"超过7天的拼单
// ==========================================
function startAutoCompleteCron() {
  const INTERVAL_MS = 60 * 60 * 1000; // 每小时执行一次

  function autoComplete() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const result = db.prepare(`
        UPDATE group_buys
        SET status = '已完成'
        WHERE status = '已送达'
          AND delivered_at IS NOT NULL
          AND delivered_at < ?
      `).run(sevenDaysAgo);

      if (result.changes > 0) {
        console.log(`[cron] 自动完成 ${result.changes} 个拼单`);
      }
    } catch (err) {
      console.error('[cron] 自动完成拼单失败:', err.message);
    }
  }

  // 启动时立即执行一次
  autoComplete();
  setInterval(autoComplete, INTERVAL_MS);
  console.log('[cron] 拼单自动完成任务已启动（每小时检查一次）');
}

startAutoCompleteCron();

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
