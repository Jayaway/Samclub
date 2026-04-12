// 后台管理配置
// 可通过修改此文件或环境变量配置

const config = {
  // 管理员运费预警关键词（正则匹配）
  // 商品名称包含这些关键词且总金额超过阈值时触发预警
  freightWarningKeywords: /(酒|饮料|牛奶|矿泉水|纯净水|碳酸饮料)/,
  freightWarningThreshold: 200, // 触发预警的金额阈值（元）
};

export default config;
