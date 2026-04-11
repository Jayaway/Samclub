<template>
  <div class="page-container">
    <!-- 顶部导航 -->
    <div class="top-header">
      <van-nav-bar title="我的拼单" />
    </div>

    <!-- Tab切换 -->
    <van-tabs v-model:active="activeTab" sticky>
      <van-tab title="我发起的">
        <div class="tab-content">
          <div v-if="myGroupBuys.length === 0" class="empty-state">
            <van-empty description="暂无发起的拼单">
              <van-button type="primary" size="small" round @click="goCreate">
                发起拼单
              </van-button>
            </van-empty>
          </div>

          <div v-for="item in myGroupBuys" :key="item.id" class="order-card" @click="goDetail(item.id)">
            <div class="order-header">
              <span class="order-title">{{ item.title }}</span>
              <span class="order-status" :class="getStatusClass(item.status)">
                {{ item.status }}
              </span>
            </div>
            <div class="order-info">
              <span>
                <van-icon name="friends-o" />
                {{ item.member_count || 0 }}人
              </span>
              <span v-if="item.has_frozen" class="frozen-tag">
                <van-icon name="snowflake-o" />
                含生鲜
              </span>
            </div>
            <div class="order-footer">
              <span class="order-amount">¥{{ item.total_cost?.toFixed(2) || '0.00' }}</span>
              <div class="order-actions">
                <van-button size="small" type="danger" plain round @click.stop="deleteOrder(item)">
                  删除
                </van-button>
                <van-button size="small" type="primary" round @click.stop="manageOrder(item)">
                  管理
                </van-button>
              </div>
            </div>
          </div>
        </div>
      </van-tab>

      <van-tab title="我参与的">
        <div class="tab-content">
          <div v-if="joinedGroupBuys.length === 0" class="empty-state">
            <van-empty description="暂无参与的拼单">
              <van-button type="primary" size="small" round @click="goSquare">
                去凑单
              </van-button>
            </van-empty>
          </div>

          <div v-for="item in joinedGroupBuys" :key="item.id" class="order-card" @click="goDetail(item.id)">
            <div class="order-header">
              <span class="order-title">{{ item.title }}</span>
              <span class="order-status" :class="getStatusClass(item.status)">
                {{ getMyPaymentStatus(item) }}
              </span>
            </div>
            <div class="order-info">
              <span>
                <van-icon name="user-o" />
                发起人：{{ item.leader_name }}
              </span>
            </div>
            <div class="order-footer">
              <span class="order-amount">¥{{ getMyCost(item)?.toFixed(2) || '0.00' }}</span>
              <van-button
                size="small"
                :type="isPaid(item) ? 'default' : 'primary'"
                round
                @click.stop="goPay(item)"
              >
                {{ isPaid(item) ? '查看详情' : '上传凭证' }}
              </van-button>
            </div>
          </div>
        </div>
      </van-tab>
    </van-tabs>

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
      <div class="bottom-nav-item active">
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showSuccessToast } from 'vant';
import { useUserStore } from '../stores/user';
import { useGroupBuyStore } from '../stores/groupBuy';

const router = useRouter();
const userStore = useUserStore();
const groupBuyStore = useGroupBuyStore();

const activeTab = ref(0);
const myGroupBuys = ref([]);
const joinedGroupBuys = ref([]);
const myPayments = ref({});
const myCosts = ref({});

const user = computed(() => userStore.user);

onMounted(async () => {
  await loadData();
});

async function loadData() {
  try {
    await groupBuyStore.fetchGroupBuys();
    const allGroupBuys = groupBuyStore.groupBuys;

    myGroupBuys.value = allGroupBuys.filter(gb => gb.creator_id === user.value?.id);
    joinedGroupBuys.value = allGroupBuys.filter(gb => gb.creator_id !== user.value?.id);

    // 获取我的费用分摊信息
    for (const gb of joinedGroupBuys.value) {
      try {
        const costData = await groupBuyStore.fetchCostDetails(gb.id);
        const myDetail = costData.costDetails?.find(d => d.user_id === user.value?.id);
        if (myDetail) {
          myCosts.value[gb.id] = myDetail.final_amount;
        }
      } catch (e) {
        console.error(e);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function getStatusClass(status) {
  switch (status) {
    case '进行中': return 'status-active';
    case '已完成': return 'status-done';
    case '已取消': return 'status-cancelled';
    default: return '';
  }
}

function getMyPaymentStatus(groupBuy) {
  const payment = myPayments.value[groupBuy.id];
  if (!payment) return '未付款';
  return payment.status === '已确认' ? '已付款' : '待确认';
}

function getMyCost(groupBuy) {
  return myCosts.value[groupBuy.id] || 0;
}

function isPaid(groupBuy) {
  const payment = myPayments.value[groupBuy.id];
  return payment?.status === '已确认';
}

function goDetail(id) {
  router.push(`/detail/${id}`);
}

function goSquare() {
  router.push('/square');
}

function goCreate() {
  router.push('/create');
}

function goProfile() {
  router.push('/profile');
}

function goPay(item) {
  router.push(`/detail/${item.id}`);
}

async function deleteOrder(item) {
  try {
    await groupBuyStore.deleteGroupBuy(item.id);
    showSuccessToast('已删除');
    loadData();
  } catch (e) {
    showToast('删除失败');
  }
}

function manageOrder(item) {
  showToast('管理功能开发中');
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
}

.tab-content {
  padding: 12px;
}

.order-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 12px;
  cursor: pointer;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.order-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.order-status {
  font-size: 12px;
  font-weight: 500;
}

.status-active {
  color: var(--primary-color);
}

.status-done {
  color: var(--success-color);
}

.status-cancelled {
  color: var(--danger-color);
}

.order-info {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
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
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.order-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-color);
}

.order-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  padding: 48px 0;
}
</style>
