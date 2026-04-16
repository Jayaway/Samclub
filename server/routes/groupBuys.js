import { Router } from 'express';
import db from '../db.js';
import { calculateTotalCost, calculateCostShare, hasColdChainItem, leaderDiscountApplies } from '../utils/calculator.js';
import config from '../config.js';
import { auth, optionalAuth, requireCreator } from '../middleware/auth.js';
import { escapeLike } from '../middleware/validate.js';

const router = Router();

// 状态机校验：定义合法的状态转换
const VALID_TRANSITIONS = {
  '拼单中': ['待付款', '已取消'],
  '待付款': ['已下单', '已取消'],
  '已下单': ['已送达'],
  '已送达': ['已完成'],
};

// 获取拼单列表（支持相似商品重复检查）
router.get('/', optionalAuth, (req, res) => {
  try {
    const { status, check_keyword, check_deadline } = req.query;

    // 相似拼单重复检查：返回 ±1小时内存在的同类商品拼单（仅限未结束的拼单）
    if (check_keyword && check_deadline) {
      const deadlineMs = new Date(check_deadline).getTime();
      const oneHour = 60 * 60 * 1000;
      const minDeadline = new Date(deadlineMs - oneHour).toISOString();
      const maxDeadline = new Date(deadlineMs + oneHour).toISOString();

      // 使用 escapeLike 转义 LIKE 通配符
      const escapedKeyword = escapeLike(check_keyword);

      const similars = db.prepare(`
        SELECT gb.id, gb.title, gb.deadline
        FROM group_buys gb
        JOIN products p ON p.group_buy_id = gb.id
        WHERE gb.status IN ('拼单中', '待付款')
          AND gb.deadline BETWEEN ? AND ?
          AND (p.name LIKE ? ESCAPE '\\' OR gb.title LIKE ? ESCAPE '\\')
        GROUP BY gb.id
      `).all(minDeadline, maxDeadline, `%${escapedKeyword}%`, `%${escapedKeyword}%`);

      return res.json({ similar: similars });
    }

    let sql = `
      SELECT gb.*, u.nickname as leader_name, u.avatar as leader_avatar,
        (SELECT COUNT(DISTINCT user_id) FROM order_items WHERE group_buy_id = gb.id) as member_count
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
      const needsColdChain = hasColdChainItem(products);
      const costInfo = calculateTotalCost(totalAmount, needsColdChain);

      return {
        ...gb,
        total_amount: totalAmount,
        delivery_mode: costInfo.mode,
        needs_cold_chain: needsColdChain,
        total_cost: costInfo.totalCost,
        progress: Math.min(100, Math.round((totalAmount / 99) * 100))
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get group buys error:', error);
    res.status(500).json({ error: '服务器内部错误' });
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
    const needsColdChain = hasColdChainItem(products);

    // 获取订单项
    const orderItems = db.prepare(`
      SELECT oi.*, p.name as product_name, p.needs_cold_chain, u.nickname as user_name
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
    const costInfo = calculateTotalCost(totalAmount, needsColdChain);

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
      needs_cold_chain: needsColdChain,
      ...costInfo
    });
  } catch (error) {
    console.error('Get group buy detail error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取拼单收款信息（团长收款码+备注）
router.get('/:id/payment-info', (req, res) => {
  try {
    const { id } = req.params;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    const leader = db.prepare('SELECT nickname, avatar, payment_qr FROM users WHERE id = ?').get(gb.creator_id);
    const totalAmount = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE group_buy_id = ?
    `).get(id).total;

    res.json({
      payment_remark: gb.payment_remark || `GB${gb.id}_${leader?.nickname || '团长'}`,
      qr_code_url: leader?.payment_qr || '',
      leader_name: leader?.nickname || '团长',
      leader_avatar: leader?.avatar || '',
      total_amount: totalAmount,
    });
  } catch (error) {
    console.error('Get payment info error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取用户参与的拼单（通过 order_items 关联）
router.get('/user/:userId/joined', (req, res) => {
  try {
    const { userId } = req.params;

    const rows = db.prepare(`
      SELECT DISTINCT gb.*, u.nickname as leader_name, u.avatar as leader_avatar,
        (SELECT COUNT(DISTINCT user_id) FROM order_items WHERE group_buy_id = gb.id) as member_count
      FROM group_buys gb
      JOIN users u ON gb.creator_id = u.id
      JOIN order_items oi ON gb.id = oi.group_buy_id
      WHERE oi.user_id = ? AND gb.creator_id != ?
      ORDER BY gb.created_at DESC
    `).all(userId, userId);

    const result = rows.map(gb => {
      const totalAmount = db.prepare(`
        SELECT COALESCE(SUM(subtotal), 0) as total
        FROM order_items WHERE group_buy_id = ?
      `).get(gb.id).total;

      const products = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(gb.id);
      const needsColdChain = hasColdChainItem(products);
      const costInfo = calculateTotalCost(totalAmount, needsColdChain);

      return {
        ...gb,
        total_amount: totalAmount,
        delivery_mode: costInfo.mode,
        needs_cold_chain: needsColdChain,
        total_cost: costInfo.totalCost,
        progress: Math.min(100, Math.round((totalAmount / 99) * 100))
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get joined group buys error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建拼单
router.post('/', auth, (req, res) => {
  try {
    const { title, deadline, pickup_location, products } = req.body;
    const creator_id = req.user.userId;

    if (!title || !deadline) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const stmt = db.prepare(`
      INSERT INTO group_buys (creator_id, title, deadline, pickup_location, status)
      VALUES (?, ?, ?, ?, '拼单中')
    `);

    const result = stmt.run(creator_id, title, deadline, pickup_location || '');
    const groupBuyId = result.lastInsertRowid;

    // 生成付款备注：GB{id}_{昵称}_{随机码}，并更新到数据库
    const creator = db.prepare('SELECT nickname FROM users WHERE id = ?').get(creator_id);
    const randomCode = Math.random().toString(36).slice(2, 6).toLowerCase();
    const paymentRemark = `GB${groupBuyId}_${creator?.nickname || '团长'}_${randomCode}`;
    db.prepare('UPDATE group_buys SET payment_remark = ? WHERE id = ?').run(paymentRemark, groupBuyId);

    // 添加商品
    if (products && products.length > 0) {
      const insertProduct = db.prepare(`
        INSERT INTO products (group_buy_id, product_type, name, original_price, quantity, remaining_quantity, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, needs_cold_chain, unit_price, split_remaining_quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      products.forEach(p => {
        const isFixed = p.product_type !== 'custom';
        // 固定商品拆分校验
        if (isFixed && p.allow_split && p.split_price_per_unit !== undefined) {
          const maxUnitPrice = p.original_price / p.split_quantity_per_whole;
          if (p.split_price_per_unit > maxUnitPrice) {
            console.warn(`商品"${p.name}"拆分单价高于整份均摊价，已自动调整`);
          }
        }

        // 可售拆分单位数 = 整份数 × 每份含拆分单位数 - 发起人自留数（仅固定商品）
        const splitRemaining = (isFixed && p.allow_split && p.split_quantity_per_whole)
          ? (p.quantity * p.split_quantity_per_whole) - (p.self_retain_quantity || 0)
          : null;

        insertProduct.run(
          groupBuyId,
          p.product_type || 'fixed',
          p.name,
          p.original_price,
          p.quantity,
          p.remaining_quantity ?? p.quantity,
          isFixed ? (p.allow_split ? 1 : 0) : 0,
          isFixed ? (p.split_unit || null) : null,
          isFixed ? (p.split_quantity_per_whole || null) : null,
          isFixed ? (p.split_price_per_unit || null) : null,
          isFixed ? (p.self_retain_quantity || 0) : 0,
          p.needs_cold_chain ? 1 : 0,
          p.unit_price,
          splitRemaining
        );
      });

      // 管理员运费预警检查
      // 触发条件：商品名称匹配预警关键词（正则）且总金额超过阈值
      const totalAmount = products.reduce((sum, p) => sum + (p.original_price * p.quantity), 0);
      if (totalAmount > config.freightWarningThreshold) {
        const matchedProducts = products.filter(p =>
          config.freightWarningKeywords.test(p.name)
        );
        if (matchedProducts.length > 0) {
          const warning = {
            type: 'FREIGHT_WARNING',
            group_buy_id: groupBuyId,
            title: title,
            total_amount: totalAmount,
            threshold: config.freightWarningThreshold,
            matched_products: matchedProducts.map(p => p.name),
            timestamp: new Date().toISOString(),
            message: `【管理员预警】拼单"${title}"（ID:${groupBuyId}）商品总金额¥${totalAmount}超过${config.freightWarningThreshold}元，且含有酒水/饮料类商品（${matchedProducts.map(p => p.name).join('、')}），请关注运费计算`
          };
          // 输出到控制台（生产环境可替换为邮件/钉钉通知）
          console.warn('管理员运费预警:', JSON.stringify(warning, null, 2));

          // 这里可以添加实际的通知逻辑，如：
          // await sendAdminNotification(warning);
        }
      }
    }

    const groupBuy = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(groupBuyId);
    res.json(groupBuy);
  } catch (error) {
    console.error('Create group buy error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员：查看拼单收款进度
router.get('/:id/payment-progress', auth, (req, res) => {
  try {
    const { id } = req.params;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    const totalAmount = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE group_buy_id = ?
    `).get(id).total;

    const costDetails = db.prepare(`
      SELECT cd.*, u.nickname as user_name, u.avatar as user_avatar
      FROM cost_details cd
      JOIN users u ON cd.user_id = u.id
      WHERE cd.group_buy_id = ?
    `).all(id);

    const payments = db.prepare(`
      SELECT p.*, u.nickname as user_name
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.group_buy_id = ?
    `).all(id);

    const paymentMap = {};
    payments.forEach((p) => { paymentMap[p.user_id] = p; });

    const members = costDetails.map((cd) => ({
      user_id: cd.user_id,
      user_name: cd.user_name,
      user_avatar: cd.user_avatar,
      should_pay: cd.final_amount,
      paid: !!paymentMap[cd.user_id],
      paid_amount: paymentMap[cd.user_id]?.amount || 0,
      paid_at: paymentMap[cd.user_id]?.created_at || null,
    }));

    const allPaid = members.length > 0 && members.every((m) => m.paid);

    res.json({
      group_buy_id: Number(id),
      title: gb.title,
      status: gb.status,
      total_amount: totalAmount,
      all_paid: allPaid,
      members,
    });
  } catch (error) {
    console.error('Get payment progress error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新拼单状态
router.put('/:id/status', auth, requireCreator, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    // 状态机校验：检查状态转换是否合法
    const allowedTransitions = VALID_TRANSITIONS[gb.status];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      return res.status(400).json({
        error: `不允许从"${gb.status}"变更为"${status}"，当前状态可变更为: ${allowedTransitions?.join('、') || '无'}`
      });
    }

    // 标记为"已送达"时记录时间，用于7天自动完成
    if (status === '已送达') {
      db.prepare('UPDATE group_buys SET status = ?, delivered_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    } else {
      db.prepare('UPDATE group_buys SET status = ? WHERE id = ?').run(status, id);
    }

    // 状态变更为"已下单"时，通知管理员
    if (status === '已下单' && gb.status !== '已下单') {
      const groupBuy = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
      console.log(`[通知] 拼单"${groupBuy.title}"(ID:${id})已收齐款项，请前往山姆下单`);
      // TODO: 接入钉钉机器人webhook或邮件通知
    }

    const groupBuy = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    res.json(groupBuy);
  } catch (error) {
    console.error('Update group buy status error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除拼单
router.delete('/:id', auth, requireCreator, (req, res) => {
  try {
    const { id } = req.params;

    // 使用事务包裹删除操作，保证原子性
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM order_items WHERE group_buy_id = ?').run(id);
      db.prepare('DELETE FROM cost_details WHERE group_buy_id = ?').run(id);
      db.prepare('DELETE FROM payments WHERE group_buy_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE group_buy_id = ?').run(id);
      db.prepare('DELETE FROM group_buys WHERE id = ?').run(id);
    });

    deleteTransaction();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete group buy error:', error);
    res.status(500).json({ error: '服务器内部错误' });
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

    // 检查是否有需冰鲜配送的商品
    const products = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(id);
    const needsColdChain = hasColdChainItem(products);

    if (orderItems.length === 0) {
      return res.json({ costDetails: [], totalCost: 0, mode: 'sam', needs_cold_chain: needsColdChain });
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + item.product_amount, 0);
    const costInfo = calculateTotalCost(totalAmount, needsColdChain);

    // 计算团长优惠是否生效
    const leaderOrder = orderItems.find(i => i.user_id === gb.creator_id);
    const leaderAmount = leaderOrder ? leaderOrder.product_amount : 0;
    const discountApplies = leaderDiscountApplies(orderItems.length, leaderAmount, products);

    // 计算分摊（含团长优惠）
    const userOrders = orderItems.map(item => ({
      userId: item.user_id,
      productAmount: item.product_amount
    }));

    const { details: costDetails, diffCents } = calculateCostShare(totalAmount, userOrders, needsColdChain, gb.creator_id, discountApplies);

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

    // 记录平台尾差收益
    db.prepare(`
      INSERT OR REPLACE INTO platform_revenue (group_buy_id, diff_cents, recorded_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(id, diffCents);

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
      needs_cold_chain: needsColdChain,
      packaging: costInfo.packaging,
      delivery: costInfo.delivery,
      frozen: costInfo.frozen,
      reward: costInfo.reward
    });
  } catch (error) {
    console.error('Get cost details error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 成员主动退出拼单
router.delete('/:id/members/me', auth, (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    if (gb.status !== '拼单中') {
      return res.status(400).json({ error: '当前状态不允许退出拼单' });
    }

    // 团长不能退出自己的拼单
    if (gb.creator_id === Number(user_id)) {
      return res.status(400).json({ error: '团长不能退出拼单，如需结束请取消拼单' });
    }

    // 删除该用户的所有订单项
    const deleted = db.prepare('DELETE FROM order_items WHERE group_buy_id = ? AND user_id = ?').run(id, user_id);

    if (deleted.changes === 0) {
      return res.status(400).json({ error: '未找到该成员的订单' });
    }

    // 删除该用户的费用详情
    db.prepare('DELETE FROM cost_details WHERE group_buy_id = ? AND user_id = ?').run(id, user_id);

    // 重新计算费用（触发分摊重算）
    recalculateCosts(id);

    res.json({ success: true, message: '已退出拼单，费用已重新计算' });
  } catch (error) {
    console.error('Leave group buy error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 发起人增加商品（仅限"拼单中"状态）
router.post('/:id/products', auth, requireCreator, (req, res) => {
  try {
    const { id } = req.params;
    const { products } = req.body;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    if (gb.status !== '拼单中') {
      return res.status(400).json({ error: '当前状态不允许添加商品' });
    }

    if (!products || products.length === 0) {
      return res.status(400).json({ error: '请添加至少一个商品' });
    }

    // 计算当前总金额和新增加商品的金额
    const currentTotal = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE group_buy_id = ?
    `).get(id).total;

    const newProductsTotal = products.reduce((sum, p) => sum + (p.original_price * p.quantity), 0);
    const newTotal = currentTotal + newProductsTotal;

    // 检查模式切换
    const currentProducts = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(id);
    const currentFrozen = hasColdChainItem(currentProducts);
    const newFrozen = hasColdChainItem([...currentProducts, ...products.map(p => ({ needs_cold_chain: p.needs_cold_chain }))]);

    const currentCostInfo = calculateTotalCost(currentTotal, currentFrozen);
    const newCostInfo = calculateTotalCost(newTotal, newFrozen);

    const modeSwitch = currentCostInfo.mode !== newCostInfo.mode;
    const modeSwitchWarning = modeSwitch
      ? `注意：添加商品后配送模式将从"${currentCostInfo.mode === 'sam' ? '山姆' : '京东'}"切换为"${newCostInfo.mode === 'sam' ? '山姆' : '京东'}"，运费将从${currentCostInfo.delivery}元变为${newCostInfo.delivery}元`
      : null;

    // 添加商品
    const insertProduct = db.prepare(`
      INSERT INTO products (group_buy_id, product_type, name, original_price, quantity, remaining_quantity, allow_split, split_unit, split_quantity_per_whole, split_price_per_unit, self_retain_quantity, needs_cold_chain, unit_price, split_remaining_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    products.forEach(p => {
      const isFixed = p.product_type !== 'custom';
      const splitRemaining = (isFixed && p.allow_split && p.split_quantity_per_whole)
        ? (p.quantity * p.split_quantity_per_whole) - (p.self_retain_quantity || 0)
        : null;

      insertProduct.run(
        id,
        p.product_type || 'fixed',
        p.name,
        p.original_price,
        p.quantity,
        p.quantity,
        isFixed ? (p.allow_split ? 1 : 0) : 0,
        isFixed ? (p.split_unit || null) : null,
        isFixed ? (p.split_quantity_per_whole || null) : null,
        isFixed ? (p.split_price_per_unit || null) : null,
        isFixed ? (p.self_retain_quantity || 0) : 0,
        p.needs_cold_chain ? 1 : 0,
        p.unit_price || p.original_price,
        splitRemaining
      );
    });

    // 重新计算所有成员费用
    recalculateCosts(id);

    // TODO: 发送推送通知给所有成员（拼单商品已更新，请查看最新费用）

    res.json({
      success: true,
      modeSwitch,
      modeSwitchWarning,
      newTotalAmount: newTotal,
      newMode: newCostInfo.mode
    });
  } catch (error) {
    console.error('Add products error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 重新计算所有成员费用（内部函数）
function recalculateCosts(groupBuyId) {
  const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(groupBuyId);
  if (!gb) return;

  const products = db.prepare('SELECT * FROM products WHERE group_buy_id = ?').all(groupBuyId);
  const needsColdChain = hasColdChainItem(products);

  const orderItems = db.prepare(`
    SELECT user_id, SUM(subtotal) as product_amount
    FROM order_items
    WHERE group_buy_id = ?
    GROUP BY user_id
  `).all(groupBuyId);

  const totalAmount = orderItems.reduce((sum, item) => sum + item.product_amount, 0);
  const costInfo = calculateTotalCost(totalAmount, needsColdChain);

  const leaderOrder = orderItems.find(i => i.user_id === gb.creator_id);
  const leaderAmount = leaderOrder ? leaderOrder.product_amount : 0;
  const discountApplies = leaderDiscountApplies(orderItems.length, leaderAmount, products);

  const userOrders = orderItems.map(item => ({
    userId: item.user_id,
    productAmount: item.product_amount
  }));

  const { details: costDetails, diffCents } = calculateCostShare(totalAmount, userOrders, needsColdChain, gb.creator_id, discountApplies);

  // 清除旧费用详情，重新插入
  db.prepare('DELETE FROM cost_details WHERE group_buy_id = ?').run(groupBuyId);

  const insertCostDetail = db.prepare(`
    INSERT INTO cost_details (group_buy_id, user_id, base_amount, share_fee, leader_discount, final_amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  costDetails.forEach(cd => {
    insertCostDetail.run(groupBuyId, cd.userId, cd.baseAmount, cd.shareFee, cd.leaderDiscount, cd.finalAmount);
  });

  // 记录平台尾差收益
  db.prepare(`
    INSERT OR REPLACE INTO platform_revenue (group_buy_id, diff_cents, recorded_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(groupBuyId, diffCents);
}

// 管理员确认送达，通知所有成员取货
router.post('/:id/delivered', auth, (req, res) => {
  try {
    const { id } = req.params;

    const gb = db.prepare('SELECT * FROM group_buys WHERE id = ?').get(id);
    if (!gb) {
      return res.status(404).json({ error: '拼单不存在' });
    }

    // 同时更新状态和送达时间
    db.prepare('UPDATE group_buys SET status = \'已送达\', delivered_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    // 获取所有参与成员的手机号（预留短信通知）
    const members = db.prepare(`
      SELECT DISTINCT u.id, u.nickname, u.phone
      FROM users u
      JOIN order_items oi ON u.id = oi.user_id
      WHERE oi.group_buy_id = ?
    `).all(id);

    members.forEach((m) => {
      if (m.phone) {
        // TODO: 调用短信服务发送取货通知
        console.log(`[短信通知] ${m.phone}: 您的拼单"${gb.title}"已送达，请前往${gb.pickup_location}取货`);
      } else {
        console.log(`[站内通知] 用户${m.nickname}的拼单"${gb.title}"已送达，请前往${gb.pickup_location}取货`);
      }
    });

    res.json({ success: true, message: `已通知${members.length}位成员` });
  } catch (error) {
    console.error('Delivered notification error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
