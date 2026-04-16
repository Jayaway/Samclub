// 后台管理配置
// 可通过修改此文件或环境变量配置

const config = {
  // 管理员运费预警关键词（正则匹配）
  // 商品名称包含这些关键词且总金额超过阈值时触发预警
  // 优先从环境变量读取，如未设置则使用默认值
  freightWarningKeywords: process.env.FREIGHT_WARNING_KEYWORDS
    ? new RegExp(process.env.FREIGHT_WARNING_KEYWORDS)
    : /(酒|饮料|牛奶|矿泉水|纯净水|碳酸饮料)/,

  // 触发预警的金额阈值（元）
  freightWarningThreshold: process.env.FREIGHT_WARNING_THRESHOLD
    ? Number(process.env.FREIGHT_WARNING_THRESHOLD)
    : 200,

  // 管理员用户ID列表（逗号分隔）
  adminUserIds: (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => !isNaN(id)),

  // JWT密钥
  jwtSecret: process.env.JWT_SECRET || 'YOUR_JWT_SECRET_HERE',
};

export default config;
