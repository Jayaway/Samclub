// 费用计算工具函数

// 山姆模式阈值
const SAM_THRESHOLD = 99;

// 费用配置
const FEES = {
  sam: { packaging: 1, delivery: 0, frozen: 2, reward: 0.5 },
  jd: { packaging: 1.2, delivery: 5, frozen: 2, reward: 0.5 }
};

/**
 * 判断使用哪种配送模式
 */
export function getDeliveryMode(totalAmount) {
  return totalAmount >= SAM_THRESHOLD ? 'sam' : 'jd';
}

/**
 * 计算是否有生鲜商品
 */
export function hasFrozenItem(products) {
  return products.some(p => p.is_frozen);
}

/**
 * 计算总成本
 */
export function calculateTotalCost(totalAmount, hasFrozen = false) {
  const mode = getDeliveryMode(totalAmount);
  const fees = FEES[mode];
  const frozenFee = hasFrozen ? FEES[mode].frozen : 0;

  const totalCost = totalAmount + fees.packaging + fees.delivery + frozenFee + fees.reward;

  return {
    mode,
    totalCost,
    packaging: fees.packaging,
    delivery: fees.delivery,
    frozen: frozenFee,
    reward: fees.reward
  };
}

/**
 * 计算每个用户的费用分摊
 * @param {number} totalAmount - 商品总金额
 * @param {Array} userOrders - 用户订单 [{ userId, productAmount }]
 * @param {boolean} hasFrozen - 是否有生鲜商品
 * @returns {Array} [{ userId, baseAmount, shareFee, leaderDiscount, finalAmount }]
 */
export function calculateCostShare(totalAmount, userOrders, hasFrozen = false) {
  const { packaging, delivery, frozen, reward } = calculateTotalCost(totalAmount, hasFrozen);
  const totalFee = packaging + delivery + frozen + reward;

  // 所有成员（包括发起人）平等分摊费用，无团长优惠
  const results = userOrders.map(order => {
    const shareRatio = totalAmount > 0 ? order.productAmount / totalAmount : 0;
    const baseAmount = order.productAmount;
    const shareFee = shareRatio * totalFee;

    return {
      userId: order.userId,
      baseAmount,
      shareFee: Math.round(shareFee * 100) / 100,
      productAmount: order.productAmount,
      leaderDiscount: 0,
      finalAmount: Math.round((baseAmount + shareFee) * 100) / 100
    };
  });

  return results;
}

/**
 * 验证费用计算总和是否正确
 */
export function verifyCostTotal(results, totalCost) {
  const sum = results.reduce((s, r) => s + r.finalAmount, 0);
  return Math.abs(sum - totalCost) < 0.01;
}
