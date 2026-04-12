// 费用计算工具函数 (SPEC1.md)

// 山姆模式阈值
const SAM_THRESHOLD = 99;

/**
 * 判断使用哪种配送模式
 */
export function getDeliveryMode(totalAmount) {
  return totalAmount >= SAM_THRESHOLD ? 'sam' : 'jd';
}

/**
 * 判断是否有生鲜商品
 */
export function hasFrozenItem(products) {
  return products.some(p => p.is_frozen);
}

/**
 * 计算总成本
 * 山姆模式(≥99): 商品 + 1(包装) + 1(含冰鲜?1:0) + 0.5(酬劳)
 * 京东模式(<99): 商品 + 5(运费) + 2(包装含冰鲜) + 0.5(酬劳)
 */
export function calculateTotalCost(totalAmount, hasFrozen = false) {
  const mode = getDeliveryMode(totalAmount);

  let delivery, packaging, frozen, reward;

  if (mode === 'sam') {
    delivery = 0;
    packaging = 1;
    frozen = hasFrozen ? 1 : 0;
    reward = 0.5;
  } else {
    // 京东模式：包装费2元已含冰鲜，不再单独收取
    delivery = 5;
    packaging = 2;
    frozen = 0;
    reward = 0.5;
  }

  const totalCost = totalAmount + delivery + packaging + frozen + reward;

  return { mode, totalCost, delivery, packaging, frozen, reward };
}

/**
 * 计算每个用户的费用分摊（含团长优惠逻辑）
 *
 * @param {number} totalAmount - 商品总金额
 * @param {Array} userOrders - [{ userId, productAmount }]
 * @param {boolean} hasFrozen - 是否有生鲜商品
 * @param {number} leaderId - 团长userId
 * @param {boolean} leaderDiscountApplies - 团长优惠是否生效
 * @returns {Array} [{ userId, baseAmount, shareFee, leaderDiscount, finalAmount }]
 */
export function calculateCostShare(totalAmount, userOrders, hasFrozen = false, leaderId = null, leaderDiscountApplies = false) {
  const { delivery, packaging, frozen, reward, totalCost } = calculateTotalCost(totalAmount, hasFrozen);
  const totalFee = delivery + packaging + frozen + reward;

  const n = userOrders.length;

  // 先计算每人初步应付（不含团长优惠）
  const prePayCents = userOrders.map(order => {
    const shareRatio = totalAmount > 0 ? order.productAmount / totalAmount : 0;
    const prePay = order.productAmount + shareRatio * totalFee;
    return {
      userId: order.userId,
      baseAmount: order.productAmount,
      shareFee: shareRatio * totalFee,
      // 以分为单位存储，避免浮点误差
      prePayCents: Math.round(prePay * 100)
    };
  });

  // 应用团长优惠
  const LEADER_DISCOUNT_CENTS = 200; // 2元 = 200分

  const finalCents = prePayCents.map(item => {
    let finalC = item.prePayCents;

    if (leaderDiscountApplies && n > 1) {
      if (item.userId === leaderId) {
        finalC -= LEADER_DISCOUNT_CENTS;
      } else {
        // 其他成员均摊2元
        finalC += Math.round(LEADER_DISCOUNT_CENTS / (n - 1));
      }
    }

    return { ...item, finalCents: finalC };
  });

  // 尾差处理：sum(final) 与 totalCost 的差额加给团长（平台不亏损）
  const totalCostCents = Math.round(totalCost * 100);
  const sumFinalCents = finalCents.reduce((s, i) => s + i.finalCents, 0);
  const diffCents = totalCostCents - sumFinalCents;

  // 找团长条目，或第一个
  const leaderIdx = finalCents.findIndex(i => i.userId === leaderId);
  const adjustIdx = leaderIdx >= 0 ? leaderIdx : 0;
  if (diffCents !== 0) {
    finalCents[adjustIdx].finalCents += diffCents;
  }

  return finalCents.map(item => ({
    userId: item.userId,
    baseAmount: item.baseAmount,
    shareFee: Math.round(item.shareFee * 100) / 100,
    leaderDiscount: leaderDiscountApplies && item.userId === leaderId ? 2 : 0,
    finalAmount: item.finalCents / 100
  }));
}

/**
 * 判断团长优惠是否生效
 * 不生效条件:
 * 1. 只有发起人一人
 * 2. 发起人商品金额 >= 99 且 发起人未开启任何商品的"允许拆分"
 *
 * @param {number} memberCount - 总人数
 * @param {number} leaderAmount - 发起人商品金额
 * @param {Array} products - 发起人相关商品 [{ is_split_allowed }]
 * @returns {boolean}
 */
export function leaderDiscountApplies(memberCount, leaderAmount, products = []) {
  if (memberCount <= 1) return false;
  const hasSplitProduct = products.some(p => p.is_split_allowed || p.allow_split);
  if (leaderAmount >= 99 && !hasSplitProduct) return false;
  return true;
}
