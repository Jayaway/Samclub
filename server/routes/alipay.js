import { Router } from 'express';
import db from '../db.js';
import { generateOutTradeNo, alipayPagePay, alipayWapPay, verifyNotifySign } from '../utils/alipay.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/alipay/pay
 * 发起支付（统一入口，根据设备类型选择 PC/WAP 支付）
 * Body: { group_buy_id, amount, device: 'mobile' | 'pc' }
 */
router.post('/pay', auth, async (req, res) => {
  try {
    const { group_buy_id, amount, device = 'auto' } = req.body;
    const user_id = req.user.userId;

    if (!group_buy_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 获取拼单信息作为订单标题
    const gb = db.prepare('SELECT title FROM group_buys WHERE id = ?').get(group_buy_id);
    const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(user_id);
    const subject = `校园山姆拼单-${gb?.title || `拼单#${group_buy_id}`}`;
    const outTradeNo = generateOutTradeNo(group_buy_id, user_id);

    // 判断设备类型
    let finalDevice = device;
    if (device === 'auto') {
      const ua = req.headers['user-agent'] || '';
      finalDevice = /Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'pc';
    }

    // 生成支付链接
    const isMobile = finalDevice === 'mobile';
    const { payment_url } = isMobile
      ? await alipayWapPay(outTradeNo, String(amount), subject)
      : await alipayPagePay(outTradeNo, String(amount), subject);

    // 记录支付流水（状态待确认）
    const existing = db.prepare('SELECT id FROM alipay_trades WHERE out_trade_no = ?').get(outTradeNo);
    if (!existing) {
      db.prepare(`
        INSERT INTO alipay_trades (out_trade_no, group_buy_id, user_id, amount, subject, status)
        VALUES (?, ?, ?, ?, ?, 'WAIT_BUYER_PAY')
      `).run(outTradeNo, group_buy_id, user_id, amount, subject);
    }

    res.json({ payment_url, out_trade_no: outTradeNo, device: finalDevice });
  } catch (error) {
    console.error('Alipay pay error:', error);
    res.status(500).json({ error: '支付发起失败' });
  }
});

/**
 * GET /api/alipay/return
 * 支付宝同步返回（用户支付完成后跳转回来）
 * 只做轻量跳转，实际支付结果以异步通知为准
 */
router.get('/return', (req, res) => {
  const { out_trade_no, trade_no, trade_status } = req.query;
  console.log('[Alipay Return]', { out_trade_no, trade_no, trade_status });

  // 跳转回前端支付结果页，URL参数使用 encodeURIComponent
  const success = trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED';
  const redirectUrl = success
    ? `/payment-result?status=success&trade_no=${encodeURIComponent(trade_no || '')}`
    : `/payment-result?status=cancelled&out_trade_no=${encodeURIComponent(out_trade_no || '')}`;

  res.redirect(`${process.env.ALIPAY_RETURN_URL?.replace('/payment-callback', '') || 'http://localhost:5175'}${redirectUrl}`);
});

/**
 * POST /api/alipay/notify
 * 支付宝异步通知（服务器验签后更新订单状态）
 */
router.post('/notify', (req, res) => {
  try {
    const params = req.body;
    console.log('[Alipay Notify]', params);

    const { out_trade_no, trade_no, trade_status, total_amount, buyer_logon_id } = params;

    // 生产环境强制验签
    const verified = verifyNotifySign(params);
    if (!verified) {
      console.warn('[Alipay] Notify sign verification failed!');
      return res.send('fail');
    }

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      // 更新 alipay_trades 表
      db.prepare(`
        UPDATE alipay_trades
        SET status = 'TRADE_SUCCESS', trade_no = ?, buyer_logon_id = ?, notify_time = datetime('now')
        WHERE out_trade_no = ?
      `).run(trade_no || '', buyer_logon_id || '', out_trade_no);

      // 同时更新 payments 表（如果存在）
      const trade = db.prepare('SELECT * FROM alipay_trades WHERE out_trade_no = ?').get(out_trade_no);
      if (trade) {
        // 金额校验：确保通知金额与记录金额一致
        if (total_amount && Number(total_amount) !== Number(trade.amount)) {
          console.error(`[Alipay] Amount mismatch! expected: ${trade.amount}, received: ${total_amount}`);
          return res.send('fail');
        }

        db.prepare(`
          UPDATE payments
          SET status = '已确认', confirm_time = datetime('now')
          WHERE group_buy_id = ? AND user_id = ?
        `).run(trade.group_buy_id, trade.user_id);

        db.prepare(`
          UPDATE cost_details
          SET paid_status = '已确认'
          WHERE group_buy_id = ? AND user_id = ?
        `).run(trade.group_buy_id, trade.user_id);
      }

      console.log(`[Alipay] Trade ${out_trade_no} paid successfully!`);
    }

    res.send('success');
  } catch (error) {
    console.error('[Alipay] Notify error:', error);
    res.send('fail');
  }
});

/**
 * GET /api/alipay/status/:outTradeNo
 * 查询支付状态（前端轮询用）
 */
router.get('/status/:outTradeNo', (req, res) => {
  try {
    const { outTradeNo } = req.params;
    const trade = db.prepare('SELECT * FROM alipay_trades WHERE out_trade_no = ?').get(outTradeNo);
    if (!trade) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json({
      out_trade_no: trade.out_trade_no,
      status: trade.status,
      trade_no: trade.trade_no,
      amount: trade.amount,
    });
  } catch (error) {
    console.error('Get alipay status error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
