import { Router } from 'express';
import db from '../db.js';
import { calculateTotalCost, calculateCostShare, hasFrozenItem } from '../utils/calculator.js';

const router = Router();

// 获取拼单列表
router.get('/', (req, res) => {
  try {
    const { status, sort } = req.query;

    let sql = `
      SELECT gb.*, u.nickname as leader_name, u.avatar as leader_avatar,
        (SELECT COUNT(*) FROM order_items WHERE group_buy_id = gb.id) as member_count
      FROM group_buys gb
      JOIN users u ON gb.creator_id = u.id
    `;

    const params = [];
    if (status) {
      sql += ' WHERE gb.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY gb.created_at DESC';

    const groupBuys = db.prepare(sql).all(...params);

    // 计算每个拼单的总金额和进度
    const result = groupBuys.map(gb => {
      const totalAmount = db.prepare(`
        SELECT COALESCE(SUM(subtotal), 0) as total
        FROM order_items WHERE group_buy_id = ?
      `).get(gb.id).total;

      const products = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(gb.id);
      const frozen = hasFrozenItem(products);
      const costInfo = calculateTotalCost(totalAmount, frozen);

      return {
        ...gb,
        total_amount: totalAmount,
        delivery_mode: costInfo.mode,
        has_frozen: frozen,
        total_cost: costInfo.totalCost,
        progress: Math.min(100, Math.round((totalAmount / 99) * 100))
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个拼单详情
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const gb = db.prepare(`
      SELECT gb.*, u.nickname as leader_name, u.avatar as leader_avatar
      FROM group_buys gb
      JOIN users u ON gb.creator_id = u.id
      WHERE gb.id = ?
    `).get(id);

    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    // 获取商品列表
    const products = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(id);
    const frozen = hasFrozenItem(products);

    // 获取订单项
    const orderItems = db.prepare(`
      SELECT oi.*, p.name as product_name, p.is_frozen, u.nickname as user_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON oi.user_id = u.id
      WHERE oi.group_buy_id = ?
    `).all(id);

    // 获取费用详情
    const costDetails = db.prepare(`
      SELECT cd.*, u.nickname as user_name
      FROM cost_details cd
      JOIN users u ON cd.user_id = u.id
      WHERE cd.group_buy_id = ?
    `).all(id);

    // 计算总金额和费用
    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const costInfo = calculateTotalCost(totalAmount, frozen);

    // 获取成员列表
    const members = db.prepare(`
      SELECT DISTINCT u.id, u.nickname, u.avatar
      FROM users u
      JOIN order_items oi ON u.id = oi.user_id
      WHERE oi.group_buy_id = ?
    `).all(id);

    res.json({
      ...gb,
      products,
      orderItems,
      costDetails,
      members,
      total_amount: totalAmount,
      has_frozen: frozen,
      ...costInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建拼单
router.post('/', (req, res) => {
  try {
    const { creator_id, title, deadline, pickup_location, products } = req.body;

    if (!creator_id || !title || !deadline) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const stmt = db.prepare(`
      INSERT INTO group_buys (creator_id, title, deadline, pickup_location, status)
      VALUES (?, ?, ?, ?, '进行中')
    `);

    const result = stmt.run(creator_id, title, deadline, pickup_location || '');
    const groupBuyId = result.lastInsertRowid;

    // 添加商品
    if (products && products.length > 0) {
      const insertProduct = db.prepare(`
        INSERT INTO products (group_buy_id, name, original_price, total_quantity, remaining_quantity, is_split_allowed, is_frozen, unit_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      products.forEach(p => {
        insertProduct.run(
          groupBuyId,
          p.name,
          p.original_price,
          p.total_quantity,
          p.remaining_quantity ?? p.total_quantity,
          p.is_split_allowed ? 1 : 0,
          p.is_frozen ? 1 : 0,
          p.unit_price
        );
      });
    }

    const groupBuy = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(groupBuyId);
    res.json(groupBuy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新拼单状态
router.put('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const stmt = db.prepare('UPDATE group_buys SET status = ? WHERE id = ?');
    stmt.run(status, id);

    const groupBuy = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    res.json(groupBuy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除拼单
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 删除关联数据
    db.prepare('DELETE FROM order_items WHERE group_buy_id = ?').run(id);
    db.prepare('DELETE FROM cost_details WHERE group_buy_id = ?').run(id);
    db.prepare('DELETE FROM payments WHERE group_buy_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE group_buy_id = ?').run(id);
    db.prepare('DELETE FROM group_buys WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取拼单费用详情（动态计算）
router.get('/:id/cost-details', (req, res) => {
  try {
    const { id } = req.params;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    // 获取所有订单项
    const orderItems = db.prepare(`
      SELECT user_id, SUM(subtotal) as product_amount
      FROM order_items
      WHERE group_buy_id = ?
      GROUP BY user_id
    `).all(id);

    // 检查是否有生鲜商品
    const products = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(id);
    const frozen = hasFrozenItem(products);

    if (orderItems.length === 0) {
      return res.json({ costDetails: [], totalCost: 0, mode: 'sam', has_frozen: frozen });
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + item.product_amount, 0);
    const costInfo = calculateTotalCost(totalAmount, frozen);

    // 计算分摊（所有成员平等分摊，无团长优惠）
    const userOrders = orderItems.map(item => ({
      userId: item.user_id,
      productAmount: item.product_amount
    }));

    const costDetails = calculateCostShare(totalAmount, userOrders, frozen);

    // 保存到数据库
    const insertCostDetail = db.prepare(`
      INSERT OR REPLACE INTO cost_details (group_buy_id, user_id, base_amount, share_fee, leader_discount, final_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateCostDetail = db.prepare(`
      UPDATE cost_details
      SET base_amount = ?, share_fee = ?, leader_discount = ?, final_amount = ?
      WHERE group_buy_id = ? AND user_id = ?
    `);

    costDetails.forEach(cd => {
      const existing = db.prepare(
        'SELECT id FROM cost_details WHERE group_buy_id = ? AND user_id = ?'
      ).get(id, cd.userId);

      if (existing) {
        updateCostDetail.run(cd.baseAmount, cd.shareFee, cd.leaderDiscount, cd.finalAmount, id, cd.userId);
      } else {
        insertCostDetail.run(id, cd.userId, cd.baseAmount, cd.shareFee, cd.leaderDiscount, cd.finalAmount);
      }
    });

    // 获取带用户名的费用详情
    const details = db.prepare(`
      SELECT cd.*, u.nickname as user_name
      FROM cost_details cd
      JOIN users u ON cd.user_id = u.id
      WHERE cd.group_buy_id = ?
    `).all(id);

    res.json({
      costDetails: details,
      totalCost: costInfo.totalCost,
      mode: costInfo.mode,
      has_frozen: frozen,
      packaging: costInfo.packaging,
      delivery: costInfo.delivery,
      frozen: costInfo.frozen,
      reward: costInfo.reward
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
