/**
 * 短信验证码服务
 * 支持阿里云短信和腾讯云短信
 */

// 验证码存储（生产环境应使用 Redis）
const verificationCodes = new Map();

// 验证码配置
const CODE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟过期
const CODE_RESEND_INTERVAL = 60 * 1000; // 60秒内不能重复发送
const CODE_MAX_ATTEMPTS = 5; // 最大尝试次数

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送短信验证码
 * @param {string} phone - 手机号
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendVerificationCode(phone) {
  // 检查发送频率
  const existing = verificationCodes.get(phone);
  if (existing) {
    const elapsed = Date.now() - existing.createdAt;
    if (elapsed < CODE_RESEND_INTERVAL) {
      const waitSeconds = Math.ceil((CODE_RESEND_INTERVAL - elapsed) / 1000);
      return { success: false, message: `请${waitSeconds}秒后再试` };
    }
  }

  const code = generateCode();
  
  // 尝试发送短信
  try {
    const result = await sendSMS(phone, code);
    if (result.success) {
      // 存储验证码
      verificationCodes.set(phone, {
        code,
        createdAt: Date.now(),
        attempts: 0,
      });
      return { success: true, message: '验证码已发送' };
    }
    return result;
  } catch (error) {
    console.error('Send SMS error:', error);
    return { success: false, message: '发送失败，请稍后重试' };
  }
}

/**
 * 验证验证码
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @returns {{valid: boolean, message: string}}
 */
export function verifyCode(phone, code) {
  const stored = verificationCodes.get(phone);
  
  if (!stored) {
    return { valid: false, message: '请先获取验证码' };
  }

  // 检查过期
  if (Date.now() - stored.createdAt > CODE_EXPIRE_TIME) {
    verificationCodes.delete(phone);
    return { valid: false, message: '验证码已过期，请重新获取' };
  }

  // 检查尝试次数
  if (stored.attempts >= CODE_MAX_ATTEMPTS) {
    verificationCodes.delete(phone);
    return { valid: false, message: '验证码尝试次数过多，请重新获取' };
  }

  // 验证码错误
  if (stored.code !== code) {
    stored.attempts++;
    return { valid: false, message: `验证码错误，还剩${CODE_MAX_ATTEMPTS - stored.attempts}次机会` };
  }

  // 验证成功，删除验证码
  verificationCodes.delete(phone);
  return { valid: true, message: '验证成功' };
}

/**
 * 实际发送短信（对接短信服务商）
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendSMS(phone, code) {
  const provider = process.env.SMS_PROVIDER || 'console'; // 'aliyun' | 'tencent' | 'console'
  
  // 开发环境：仅打印到控制台，并把验证码返回给前端方便调试
  if (provider === 'console' || process.env.NODE_ENV !== 'production') {
    console.log(`[SMS] 验证码发送到 ${phone}: ${code}`);
    return { success: true, message: '验证码已发送（开发模式）', code }; // 开发模式返回验证码
  }

  // 阿里云短信
  if (provider === 'aliyun') {
    return sendAliyunSMS(phone, code);
  }

  // 腾讯云短信
  if (provider === 'tencent') {
    return sendTencentSMS(phone, code);
  }

  return { success: false, message: '短信服务未配置' };
}

/**
 * 阿里云短信发送
 * 需要安装: npm install @alicloud/dysmsapi20170525 @alicloud/openapi-client
 * 环境变量:
 *   ALIYUN_ACCESS_KEY_ID
 *   ALIYUN_ACCESS_KEY_SECRET
 *   ALIYUN_SMS_SIGN_NAME - 短信签名
 *   ALIYUN_SMS_TEMPLATE_CODE - 短信模板ID
 */
async function sendAliyunSMS(phone, code) {
  try {
    // 动态导入，避免未安装时报错
    const Dysmsapi = await import('@alicloud/dysmsapi20170525');
    const OpenApi = await import('@alicloud/openapi-client');

    const config = new OpenApi.Config({
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      endpoint: 'dysmsapi.aliyuncs.com',
    });

    const client = new Dysmsapi.default(config);
    
    const response = await client.sendSms({
      phoneNumbers: phone,
      signName: process.env.ALIYUN_SMS_SIGN_NAME,
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    });

    if (response.body.code === 'OK') {
      return { success: true, message: '验证码已发送' };
    }
    
    console.error('Aliyun SMS error:', response.body.message);
    return { success: false, message: '发送失败' };
  } catch (error) {
    console.error('Aliyun SMS error:', error);
    return { success: false, message: '短信服务配置错误' };
  }
}

/**
 * 腾讯云短信发送
 * 需要安装: npm install tencentcloud-sdk-nodejs-sms
 * 环境变量:
 *   TENCENT_SECRET_ID
 *   TENCENT_SECRET_KEY
 *   TENCENT_SMS_APP_ID - 短信应用ID
 *   TENCENT_SMS_SIGN_NAME - 短信签名
 *   TENCENT_SMS_TEMPLATE_ID - 短信模板ID
 */
async function sendTencentSMS(phone, code) {
  try {
    const tencentcloud = await import('tencentcloud-sdk-nodejs-sms');
    const SmsClient = tencentcloud.sms.v20210111.Client;

    const client = new SmsClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: 'ap-guangzhou',
    });

    const response = await client.SendSms({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: process.env.TENCENT_SMS_APP_ID,
      SignName: process.env.TENCENT_SMS_SIGN_NAME,
      TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID,
      TemplateParamSet: [code, '5'], // 验证码, 有效期分钟数
    });

    const status = response.SendStatusSet?.[0];
    if (status?.Code === 'Ok') {
      return { success: true, message: '验证码已发送' };
    }

    console.error('Tencent SMS error:', status?.Message);
    return { success: false, message: '发送失败' };
  } catch (error) {
    console.error('Tencent SMS error:', error);
    return { success: false, message: '短信服务配置错误' };
  }
}

export default {
  sendVerificationCode,
  verifyCode,
};
