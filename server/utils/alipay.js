import { AlipaySdk } from 'alipay-sdk';

const ALIPAY_APP_ID = process.env.ALIPAY_APP_ID || '';
const ALIPAY_PRIVATE_KEY = process.env.ALIPAY_PRIVATE_KEY || '';
const ALIPAY_PUBLIC_KEY = process.env.ALIPAY_PUBLIC_KEY || '';
const ALIPAY_GATEWAY = process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
const ALIPAY_RETURN_URL = process.env.ALIPAY_RETURN_URL || 'http://localhost:5175/payment-callback';
const ALIPAY_NOTIFY_URL = process.env.ALIPAY_NOTIFY_URL || 'http://localhost:100/api/alipay/notify';

let _alipaySdk = null;

export function getAlipaySdk() {
  if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
    return null; // 未配置时返回 null，走 mock 模式
  }
  if (!_alipaySdk) {
    _alipaySdk = new AlipaySdk({
      appId: ALIPAY_APP_ID,
      privateKey: ALIPAY_PRIVATE_KEY,
      alipayPublicKey: ALIPAY_PUBLIC_KEY,
      signType: 'RSA2',
      gateway: ALIPAY_GATEWAY,
    });
  }
  return _alipaySdk;
}

/**
 * 生成唯一商户订单号
 */
export function generateOutTradeNo(groupBuyId, userId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `GB${groupBuyId}U${userId}${timestamp}${random}`.toUpperCase();
}

/**
 * 电脑网站支付（PC 端跳转 Alipay 收银台）
 * @param {string} outTradeNo 商户订单号
 * @param {string} totalAmount 订单总金额（元）
 * @param {string} subject 订单标题
 * @returns {{ payment_url: string, out_trade_no: string }} 跳转 URL
 */
export async function alipayPagePay(outTradeNo, totalAmount, subject) {
  const sdk = getAlipaySdk();
  if (!sdk) {
    // Mock 模式：返回沙箱演示 URL
    const mockUrl = `${ALIPAY_GATEWAY}?out_trade_no=${outTradeNo}&total_amount=${totalAmount}&subject=${encodeURIComponent(subject)}&mock=true`;
    return { payment_url: mockUrl, out_trade_no: outTradeNo };
  }
  const result = await sdk.pageExecute('alipay.trade.page.pay', 'GET', {
    bizContent: {
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      integration_type: 'PCWEB',
    },
    returnUrl: ALIPAY_RETURN_URL,
  });
  return { payment_url: result, out_trade_no: outTradeNo };
}

/**
 * 手机网站支付（移动端，自动拉起支付宝 App，未安装则降级网页支付）
 * @param {string} outTradeNo 商户订单号
 * @param {string} totalAmount 订单总金额（元）
 * @param {string} subject 订单标题
 * @returns {{ payment_url: string, out_trade_no: string }} 跳转 URL 或表单
 */
export async function alipayWapPay(outTradeNo, totalAmount, subject) {
  const sdk = getAlipaySdk();
  if (!sdk) {
    // Mock 模式
    const mockUrl = `${ALIPAY_GATEWAY}?out_trade_no=${outTradeNo}&total_amount=${totalAmount}&subject=${encodeURIComponent(subject)}&mock=true&wap=true`;
    return { payment_url: mockUrl, out_trade_no: outTradeNo };
  }
  const result = await sdk.pageExecute('alipay.trade.wap.pay', 'GET', {
    bizContent: {
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject,
      product_code: 'QUICK_WAP_WAY',
      integration_type: 'ALIAPP',
    },
    returnUrl: ALIPAY_RETURN_URL,
  });
  return { payment_url: result, out_trade_no: outTradeNo };
}

/**
 * App 支付（支付宝小程序/外部 App 调用）
 * @param {string} outTradeNo 商户订单号
 * @param {string} totalAmount 订单总金额（元）
 * @param {string} subject 订单标题
 * @returns {{ order_str: string, out_trade_no: string }} 返回给客户端的签名字符串
 */
export async function alipayAppPay(outTradeNo, totalAmount, subject) {
  const sdk = getAlipaySdk();
  if (!sdk) {
    return { order_str: `mock_order_str_${outTradeNo}`, out_trade_no: outTradeNo };
  }
  const orderStr = await sdk.sdkExecute('alipay.trade.app.pay', {
    bizContent: {
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject,
      product_code: 'QUICK_MSECURITY_PAY',
    },
    returnUrl: ALIPAY_RETURN_URL,
  });
  return { order_str: orderStr, out_trade_no: outTradeNo };
}

/**
 * 验证支付宝异步通知签名
 * @param {object} params 通知参数
 * @returns {boolean}
 */
export function verifyNotifySign(params) {
  const sdk = getAlipaySdk();
  if (!sdk) return true; // Mock 模式跳过验签
  return sdk.checkNotifySign(params);
}
