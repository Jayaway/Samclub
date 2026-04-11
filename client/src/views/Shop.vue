<template>
  <div class="page-container">
    <!-- 顶部导航 -->
    <div class="top-header">
      <van-nav-bar
        :title="groupBuy?.title || '选购商品'"
        left-text="返回"
        @click-left="goBack"
      />
    </div>

    <div class="page-content" v-if="groupBuy">
      <!-- 拼单信息 -->
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">当前凑单</span>
          <span class="info-value">¥{{ groupBuy.total_amount.toFixed(2) }} / ¥99</span>
        </div>
        <div class="progress-bar" style="height: 6px;">
          <div
            class="progress-fill"
            :class="groupBuy.progress >= 100 ? 'green' : 'blue'"
            :style="{ width: Math.min(groupBuy.progress, 100) + '%' }"
          ></div>
        </div>
        <div class="info-hint" v-if="groupBuy.has_frozen">
          <van-icon name="snowflake-o" />
          <span>含生鲜附加费2元</span>
        </div>
        <div class="info-hint" v-else>
          <span>还差 ¥{{ (99 - groupBuy.total_amount).toFixed(2) }} 免运费</span>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="section-header">
        <span>选择商品</span>
      </div>

      <div class="product-list">
        <div v-for="product in groupBuy.products" :key="product.id" class="product-item">
          <div class="product-info">
            <div class="product-name">
              {{ product.name }}
              <span class="frozen-tag" v-if="product.is_frozen">
                <van-icon name="snowflake-o" />
                生鲜
              </span>
            </div>
            <div class="product-tags">
              <span v-if="product.is_split_allowed">可拆卖</span>
              <span>剩余 {{ product.remaining_quantity }} / {{ product.total_quantity }}</span>
            </div>
            <div class="product-price">
              ¥{{ product.unit_price.toFixed(2) }}
              <span class="per">/{{ product.is_split_allowed ? '个' : '份' }}</span>
            </div>
          </div>
          <div class="qty-control">
            <van-icon name="minus" class="qty-btn" @click="decreaseQty(product)" />
            <span class="qty-num">{{ quantities[product.id] || 0 }}</span>
            <van-icon name="plus" class="qty-btn" @click="increaseQty(product)" />
          </div>
        </div>
      </div>

      <!-- 已选商品预览 -->
      <div class="selected-preview" v-if="selectedCount > 0">
        <div class="preview-header">
          <span>已选 {{ selectedCount }} 件商品</span>
          <span class="preview-amount">¥{{ selectedAmount.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- 底部购物车 -->
    <div class="cart-bar" v-if="groupBuy">
      <div class="cart-info">
        <div class="cart-total">
          应付总额：<span class="amount">¥{{ myTotalCost.toFixed(2) }}</span>
        </div>
        <div class="cart-hint" v-if="selectedAmount > 0">
          <span v-if="myTotalCost > selectedAmount">
            含分摊费用 ¥{{ (myTotalCost - selectedAmount).toFixed(2) }}
          </span>
        </div>
      </div>
      <van-button
        type="primary"
        :disabled="selectedCount === 0"
        @click="handleJoin"
      >
        确认加入
      </van-button>
    </div>

    <!-- 底部导航 -->
    <div class="bottom-nav">
      <div class="bottom-nav-item" @click="goSquare">
        <van-icon name="shop-o" />
        <span>拼单广场</span>
      </div>
      <div class="bottom-nav-item" @click="goCreate">
        <van-icon name="add-o" />
        <span>发起拼单</span>
      </div>
      <div class="bottom-nav-item" @click="goMy">
        <van-icon name="orders-o" />
        <span>我的拼单</span>
      </div>
      <div class="bottom-nav-item" @click="goProfile">
        <van-icon name="user-o" />
        <span>个人中心</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showSuccessToast } from 'vant';
import { useUserStore } from '../stores/user';
import { useGroupBuyStore } from '../stores/groupBuy';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const groupBuyStore = useGroupBuyStore();

const groupBuy = ref(null);
const quantities = ref({});
const myOrderItems = ref({});

const groupBuyId = computed(() => route.params.id);

const selectedCount = computed(() => {
  return Object.values(quantities.value).reduce((sum, qty) => sum + qty, 0);
});

const selectedAmount = computed(() => {
  if (!groupBuy.value) return 0;
  return groupBuy.value.products.reduce((sum, p) => {
    const qty = quantities.value[p.id] || 0;
    return sum + qty * p.unit_price;
  }, 0);
});

const myTotalCost = computed(() => {
  if (!groupBuy.value || selectedAmount.value === 0) return 0;
  const { packaging, frozen, reward } = groupBuy.value;
  const shareFee = packaging + frozen + reward;
  const totalProduct = groupBuy.value.total_amount;
  const shareRatio = selectedAmount.value / totalProduct;
  // 费用分摊：个人商品金额 + 分摊比例 × 附加费用总额
  return selectedAmount.value + shareRatio * shareFee;
});

onMounted(async () => {
  await loadData();
});

watch(groupBuyId, async () => {
  await loadData();
});

async function loadData() {
  try {
    groupBuy.value = await groupBuyStore.fetchGroupBuyById(groupBuyId.value);

    // 初始化数量
    groupBuy.value?.products?.forEach(p => {
      quantities.value[p.id] = 0;
    });

    // 获取我已选购的商品
    try {
      const items = await fetchMyOrders();
      if (Array.isArray(items)) {
        items.forEach(item => {
          myOrderItems.value[item.product_id] = item;
          quantities.value[item.product_id] = item.quantity;
        });
      }
    } catch (e) {
      console.error('fetch orders error:', e);
    }
  } catch (e) {
    showToast('加载失败');
  }
}

async function fetchMyOrders() {
  const res = await fetch(`/api/order-items/user/${userStore.user.id}/group/${groupBuyId.value}`);
  return res.json();
}

function increaseQty(product) {
  const current = quantities.value[product.id] || 0;
  if (current >= product.remaining_quantity) {
    showToast('库存不足');
    return;
  }
  quantities.value[product.id] = current + 1;
}

function decreaseQty(product) {
  const current = quantities.value[product.id] || 0;
  if (current <= 0) return;
  quantities.value[product.id] = current - 1;
}

async function handleJoin() {
  if (selectedCount.value === 0) {
    showToast('请先选择商品');
    return;
  }

  try {
    // 添加/更新订单项
    for (const product of groupBuy.value.products) {
      const qty = quantities.value[product.id] || 0;
      const existing = myOrderItems.value[product.id];

      if (existing) {
        if (qty === 0) {
          await groupBuyStore.removeOrderItem(existing.id);
          delete myOrderItems.value[product.id];
        } else if (qty !== existing.quantity) {
          await groupBuyStore.addOrderItem({
            group_buy_id: groupBuyId.value,
            user_id: userStore.user.id,
            product_id: product.id,
            quantity: qty
          });
        }
      } else if (qty > 0) {
        await groupBuyStore.addOrderItem({
          group_buy_id: groupBuyId.value,
          user_id: userStore.user.id,
          product_id: product.id,
          quantity: qty
        });
      }
    }

    showSuccessToast('加入成功');
    router.push(`/detail/${groupBuyId.value}`);
  } catch (e) {
    showToast('加入失败');
  }
}

function goBack() {
  router.back();
}

function goSquare() {
  router.push('/square');
}

function goCreate() {
  router.push('/create');
}

function goMy() {
  router.push('/my');
}

function goProfile() {
  router.push('/profile');
}
</script>

<style scoped>
.page-container {
  background: var(--bg-color);
  min-height: 100vh;
  padding-bottom: calc(140px + env(safe-area-inset-bottom));
}

.top-header {
  background: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.page-content {
  padding: 12px;
}

.info-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-label {
  font-size: 13px;
  color: var(--text-muted);
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.progress-bar {
  height: 6px;
  background: #ebedf0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
}

.progress-fill.blue {
  background: var(--primary-color);
}

.progress-fill.green {
  background: var(--success-color);
}

.info-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.section-header {
  padding: 8px 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.product-list {
  margin-bottom: 12px;
}

.product-item {
  background: white;
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-info {
  flex: 1;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.frozen-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #e8f4fd;
  color: var(--frozen-color);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.product-tags {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.product-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary-color);
}

.product-price .per {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.qty-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-secondary);
}

.qty-num {
  font-size: 18px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
}

.selected-preview {
  background: white;
  border-radius: var(--radius-md);
  padding: 12px 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.preview-amount {
  font-weight: 600;
  color: var(--primary-color);
}

.cart-bar {
  position: fixed;
  bottom: calc(60px + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  background: white;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

.cart-info {
  flex: 1;
}

.cart-total {
  font-size: 14px;
  color: var(--text-secondary);
}

.cart-total .amount {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
}

.cart-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
