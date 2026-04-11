<template>
  <div class="page-container" v-if="groupBuy">
    <!-- 顶部导航 -->
    <div class="top-header">
      <van-nav-bar
        :title="groupBuy.title"
        left-text="返回"
        @click-left="goBack"
      />
    </div>

    <div class="page-content">
      <!-- 拼单信息 -->
      <div class="info-card">
        <div class="info-header">
          <span class="status-tag" :class="getStatusClass(groupBuy.status)">
            {{ groupBuy.status }}
          </span>
          <span class="countdown">
            <van-icon name="clock-o" />
            {{ formatTime(groupBuy.deadline) }}
          </span>
        </div>

        <div class="amount-highlight" :class="{ 'is-free': groupBuy.progress >= 100 }">
          <template v-if="groupBuy.progress >= 100">
            <span class="amount-text green">已免运费</span>
          </template>
          <template v-else>
            <span class="amount-num red">{{ (99 - groupBuy.total_amount).toFixed(1) }}</span>
            <span class="amount-unit">元</span>
            <span class="amount-text">即可免运费</span>
          </template>
        </div>

        <div class="progress-wrapper">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="groupBuy.progress >= 100 ? 'green' : 'blue'"
              :style="{ width: Math.min(groupBuy.progress, 100) + '%' }"
            ></div>
          </div>
          <div class="progress-info">
            <span>已凑 ¥{{ groupBuy.total_amount.toFixed(2) }}</span>
            <span>{{ groupBuy.progress }}%</span>
          </div>
        </div>

        <div class="pickup-info">
          <van-icon name="location-o" />
          <span>{{ groupBuy.pickup_location || '待定' }}</span>
        </div>
      </div>

      <!-- 费用明细 -->
      <div class="card">
        <div class="card-title-row">
          <van-icon name="coupon-o" />
          <span>费用明细</span>
        </div>

        <div class="cost-breakdown">
          <div class="cost-row">
            <span>商品总额</span>
            <span>¥{{ groupBuy.total_amount.toFixed(2) }}</span>
          </div>
          <div class="cost-row">
            <span>包装费</span>
            <span>+ ¥{{ costDetails?.packaging?.toFixed(2) || '1.00' }}</span>
          </div>
          <div class="cost-row" v-if="groupBuy.has_frozen">
            <span>
              生鲜附加费
              <van-icon name="snowflake-o" style="color: var(--frozen-color);" />
            </span>
            <span>+ ¥{{ costDetails?.frozen?.toFixed(2) || '2.00' }}</span>
          </div>
          <div class="cost-row">
            <span>平台服务费</span>
            <span>+ ¥{{ costDetails?.reward?.toFixed(2) || '0.50' }}</span>
          </div>
          <div class="cost-row total">
            <span>总费用</span>
            <span class="amount">¥{{ costDetails?.totalCost?.toFixed(2) || groupBuy.total_cost?.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="card">
        <div class="card-title-row">
          <van-icon name="orders-o" />
          <span>商品列表</span>
          <span class="card-title-hint">点击下方按钮选购</span>
        </div>

        <div v-for="product in groupBuy.products" :key="product.id" class="product-row">
          <div class="product-info">
            <span class="product-name">{{ product.name }}</span>
            <span class="frozen-tag" v-if="product.is_frozen">
              <van-icon name="snowflake-o" />
              生鲜
            </span>
          </div>
          <div class="product-right">
            <span class="product-price">¥{{ product.unit_price.toFixed(2) }}</span>
            <span class="product-qty" v-if="getMyOrder(product.id)">
              已购 {{ getMyOrder(product.id).quantity }}个
            </span>
          </div>
        </div>

        <van-button
          v-if="groupBuy.status === '进行中'"
          type="primary"
          block
          class="shop-btn"
          @click="goShop"
        >
          {{ hasOrdered ? '继续选购' : '加入拼单' }}
        </van-button>
      </div>

      <!-- 成员应付 -->
      <div class="card" v-if="costDetails?.costDetails?.length">
        <div class="card-title-row">
          <van-icon name="friends-o" />
          <span>成员应付</span>
        </div>

        <div v-for="detail in costDetails.costDetails" :key="detail.user_id" class="member-row">
          <div class="member-info">
            <div class="avatar">
              {{ detail.user_name?.charAt(0) || '?' }}
            </div>
            <div class="member-name">
              {{ detail.user_name }}
              <span class="creator-tag" v-if="detail.user_id === groupBuy.creator_id">发起人</span>
            </div>
          </div>
          <div class="member-amount">
            <span class="amount">¥{{ detail.final_amount.toFixed(2) }}</span>
            <span class="detail">
              商品¥{{ detail.base_amount.toFixed(0) }} + 分摊¥{{ detail.share_fee.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 平台收款码 -->
      <div class="card">
        <div class="card-title-row">
          <van-icon name="qr" />
          <span>平台收款码</span>
        </div>

        <div class="qr-code-box">
          <div class="qr-placeholder">
            <van-icon name="qr" />
          </div>
          <div class="qr-label">平台收款码（运营方）</div>
          <div class="qr-hint">扫码支付后上传凭证</div>
        </div>

        <van-button
          v-if="groupBuy.status === '进行中' && myCost"
          type="primary"
          block
          class="pay-btn"
          @click="showPayProof = true"
        >
          上传付款凭证
        </van-button>
      </div>

      <!-- 付款凭证上传 -->
      <van-popup v-model:show="showPayProof" position="bottom" round>
        <div class="pay-popup">
          <div class="popup-title">上传付款凭证</div>
          <div class="my-amount">
            应付金额：<span>¥{{ myCost?.toFixed(2) }}</span>
          </div>
          <van-uploader
            v-model="paymentProof"
            :max-count="1"
            :after-read="afterProofRead"
            accept="image/*"
          >
            <div class="upload-area">
              <van-icon name="photograph" />
              <span>点击上传凭证</span>
            </div>
          </van-uploader>
          <van-button type="primary" block @click="submitProof">确认提交</van-button>
        </div>
      </van-popup>
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
const costDetails = ref(null);
const myOrderItems = ref({});
const paymentProof = ref([]);
const showPayProof = ref(false);

const groupBuyId = computed(() => route.params.id);
const hasOrdered = computed(() => Object.keys(myOrderItems.value).length > 0);

const myCost = computed(() => {
  const detail = costDetails.value?.costDetails?.find(d => d.user_id === userStore.user?.id);
  return detail?.final_amount || 0;
});

const isCreator = computed(() => {
  return groupBuy.value?.creator_id === userStore.user?.id;
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
    costDetails.value = await groupBuyStore.fetchCostDetails(groupBuyId.value);

    // 获取我的订单
    const items = await fetchMyOrders();
    myOrderItems.value = {};
    items.forEach(item => {
      myOrderItems.value[item.product_id] = item;
    });
  } catch (e) {
    showToast('加载失败');
  }
}

async function fetchMyOrders() {
  const res = await fetch(`/api/order-items/user/${userStore.user.id}/group/${groupBuyId.value}`);
  return res.json();
}

function getMyOrder(productId) {
  return myOrderItems.value[productId];
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

function goShop() {
  router.push(`/shop/${groupBuyId.value}`);
}

function afterProofRead(file) {
  console.log('proof file:', file);
}

async function submitProof() {
  if (!paymentProof.value.length) {
    showToast('请上传付款凭证');
    return;
  }

  try {
    await groupBuyStore.submitPayment({
      group_buy_id: groupBuyId.value,
      user_id: userStore.user.id,
      amount: myCost.value,
      proof_image: paymentProof.value[0]?.url || ''
    });
    showSuccessToast('已提交凭证');
    showPayProof.value = false;
  } catch (e) {
    showToast('提交失败');
  }
}

function formatTime(deadline) {
  if (!deadline) return '';
  const now = new Date();
  const end = new Date(deadline);
  const diff = end - now;

  if (diff <= 0) return '已截止';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    return `${Math.floor(hours / 24)}天后`;
  }
  return `${hours}小时${minutes}分`;
}

function getStatusClass(status) {
  switch (status) {
    case '进行中': return 'status-active';
    case '已完成': return 'status-done';
    case '已取消': return 'status-cancelled';
    default: return '';
  }
}
</script>

<style scoped>
.page-container {
  background: var(--bg-color);
  min-height: 100vh;
  padding-bottom: calc(70px + env(safe-area-inset-bottom));
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

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-active {
  background: #e6f4ff;
  color: var(--primary-color);
}

.status-done {
  background: #f3ffed;
  color: var(--success-color);
}

.countdown {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
}

.amount-highlight {
  text-align: center;
  padding: 12px;
  background: #fff5f5;
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.amount-highlight.is-free {
  background: #f0fff4;
}

.amount-num {
  font-size: 28px;
  font-weight: 700;
}

.amount-num.red {
  color: var(--danger-color);
}

.amount-unit {
  font-size: 14px;
  color: var(--danger-color);
  margin-left: 2px;
}

.amount-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.amount-text.green {
  color: var(--success-color);
}

.progress-wrapper {
  margin-bottom: 12px;
}

.progress-bar {
  height: 8px;
  background: #ebedf0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
}

.progress-fill.blue {
  background: var(--primary-color);
}

.progress-fill.green {
  background: var(--success-color);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.pickup-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
}

.card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.card-title-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  margin-left: auto;
}

.cost-breakdown {
  background: var(--bg-gray);
  border-radius: var(--radius-md);
  padding: 12px;
}

.cost-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.cost-row.total {
  border-top: 1px solid var(--border-color);
  margin-top: 8px;
  padding-top: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.cost-row .amount {
  color: var(--primary-color);
  font-size: 16px;
}

.product-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.product-row:last-of-type {
  border-bottom: none;
}

.product-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
}

.frozen-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #e8f4fd;
  color: var(--frozen-color);
  border-radius: 4px;
  font-size: 10px;
}

.product-right {
  text-align: right;
}

.product-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
}

.product-qty {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
}

.shop-btn {
  margin-top: 12px;
}

.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.member-row:last-of-type {
  border-bottom: none;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.creator-tag {
  font-size: 10px;
  background: var(--accent-color);
  color: white;
  padding: 1px 4px;
  border-radius: 2px;
}

.member-amount {
  text-align: right;
}

.member-amount .amount {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.member-amount .detail {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
}

.qr-code-box {
  background: var(--bg-gray);
  border-radius: var(--radius-lg);
  padding: 24px;
  text-align: center;
}

.qr-placeholder {
  width: 120px;
  height: 120px;
  background: #dcdee0;
  border-radius: var(--radius-md);
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-placeholder :deep(.van-icon) {
  font-size: 48px;
  color: white;
}

.qr-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.qr-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.pay-btn {
  margin-top: 12px;
}

.pay-popup {
  padding: 20px;
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 16px;
}

.my-amount {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.my-amount span {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 120px;
  background: var(--bg-gray);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  gap: 8px;
}
</style>
