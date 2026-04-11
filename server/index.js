import express from 'express';
import cors from 'cors';

import usersRouter from './routes/users.js';
import groupBuysRouter from './routes/groupBuys.js';
import productsRouter from './routes/products.js';
import orderItemsRouter from './routes/orderItems.js';
import paymentsRouter from './routes/payments.js';
import costDetailsRouter from './routes/costDetails.js';

const app = express();
const PORT = process.env.PORT || 3000;

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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
