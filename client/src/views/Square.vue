<template>
  <div class="page-container">
    <!-- 顶部导航 -->
    <div class="top-header">
      <h1 class="app-title">校园山姆拼单</h1>
      <p class="app-subtitle">平台统一下单 · 满99元免运费</p>
    </div>

    <!-- 拼单列表 -->
    <div class="page-content">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <div class="group-list">
          <div
            v-for="item in groupBuys"
            :key="item.id"
            class="group-card"
            @click="goDetail(item.id)"
          >
            <!-- 第一行：状态 + 倒计时 -->
            <div class="card-top">
              <span class="status-tag" :class="getStatusClass(item.status)">{{ item.status }}</span>
              <span class="countdown">
                <van-icon name="clock-o" />
                {{ formatTime(item.deadline) }}
              </span>
            </div>

            <!-- 标题 -->
            <h3 class="card-title">{{ item.title }}</h3>

            <!-- 发起人 -->
            <div class="card-sponsor">
              <van-icon name="user-o" />
              <span>发起人：{{ item.leader_name }}</span>
            </div>

            <!-- 核心数据：差多少钱免运费 -->
            <div class="amount-box" :class="{ 'free': item.progress >= 100, 'frozen': item.has_frozen && item.progress < 100 }">
              <template v-if="item.progress >= 100">
                <span class="amount-num green">已免运费</span>
                <div class="amount-desc">还差0元，已达标</div>
              </template>
              <template v-else>
                <span class="amount-num red">{{ (99 - item.total_amount).toFixed(1) }}</span>
                <span class="amount-unit">元</span>
                <span class="amount-desc">即可免运费</span>
              </template>
            </div>

            <!-- 进度条 -->
            <div class="progress-wrapper">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :class="item.progress >= 100 ? 'green' : 'blue'"
                  :style="{ width: Math.min(item.progress, 100) + '%' }"
                ></div>
              </div>
              <div class="progress-info">
                <span>已凑 ¥{{ item.total_amount.toFixed(0) }} / ¥99</span>
                <span>{{ item.progress }}%</span>
              </div>
            </div>

            <!-- 生鲜标识 -->
            <div class="card-tags" v-if="item.has_frozen">
              <span class="frozen-tag">
                <van-icon name="snowflake-o" />
                含生鲜商品
              </span>
            </div>

            <!-- 底部：人数 + 取货点 + 按钮 -->
            <div class="card-footer">
              <div class="card-meta">
                <span>
                  <van-icon name="friends-o" />
                  {{ item.member_count || 0 }}人
                </span>
                <span class="dot">·</span>
                <span>
                  <van-icon name="location-o" />
                  {{ item.pickup_location || '待定' }}
                </span>
              </div>
              <van-button
                size="small"
                :type="item.progress >= 100 ? 'default' : 'primary'"
                round
                @click.stop="goDetail(item.id)"
              >
                {{ item.progress >= 100 ? '查看详情' : '去凑单' }}
                <van-icon name="arrow" />
              </van-button>
            </div>
          </div>

          <!-- 空状态 -->
          <van-empty v-if="groupBuys.length === 0" description="暂无拼单" class="empty-state">
            <template #image>
              <van-icon name="plus" size="48" style="color: var(--primary-color);" />
            </template>
            <van-button type="primary" size="small" round @click="goCreate">
              发起拼单
            </van-button>
          </van-empty>
        </div>
      </van-pull-refresh>
    </div>

    <!-- 悬浮按钮 -->
    <van-button type="warning" size="large" class="fab" icon="plus" @click="goCreate" />

    <!-- 底部导航 -->
    <div class="bottom-nav">
      <div class="bottom-nav-item active" @click="goSquare">
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useUserStore } from '../stores/user';
import { useGroupBuyStore } from '../stores/groupBuy';

const router = useRouter();
const userStore = useUserStore();
const groupBuyStore = useGroupBuyStore();

const refreshing = ref(false);

const groupBuys = computed(() => groupBuyStore.groupBuys);

onMounted(() => {
  groupBuyStore.fetchGroupBuys();
});

async function onRefresh() {
  await groupBuyStore.fetchGroupBuys();
  refreshing.value = false;
  showToast('刷新成功');
}

function goDetail(id) {
  router.push(`/detail/${id}`);
}

function goCreate() {
  router.push('/create');
}

function goMy() {
  router.push('/my');
}

function goSquare() {
  // Already on square
}

function goProfile() {
  router.push('/profile');
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
  background: var(--primary-color);
  padding: 20px 16px 24px;
  color: white;
  text-align: center;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.app-subtitle {
  font-size: 13px;
  opacity: 0.9;
}

.page-content {
  margin-top: -12px;
}

.group-list {
  padding: 12px;
}

.group-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
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

.status-cancelled {
  background: #fff2f0;
  color: var(--danger-color);
}

.countdown {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.card-sponsor {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.amount-box {
  text-align: center;
  padding: 12px;
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.amount-box.normal {
  background: linear-gradient(135deg, #fff5f5 0%, #fff 100%);
}

.amount-box.frozen {
  background: linear-gradient(135deg, #e8f4fd 0%, #fff 100%);
}

.amount-box.free {
  background: linear-gradient(135deg, #f0fff4 0%, #fff 100%);
}

.amount-num {
  font-size: 28px;
  font-weight: 700;
}

.amount-num.red {
  color: var(--danger-color);
}

.amount-num.green {
  color: var(--success-color);
}

.amount-unit {
  font-size: 14px;
  color: var(--danger-color);
  margin-left: 2px;
}

.amount-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
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
  transition: width 0.3s ease;
}

.progress-fill.blue {
  background: linear-gradient(90deg, var(--primary-color) 0%, var(--primary-light) 100%);
}

.progress-fill.green {
  background: linear-gradient(90deg, var(--success-color) 0%, #34d399 100%);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.card-tags {
  margin-bottom: 12px;
}

.frozen-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #e8f4fd;
  color: var(--frozen-color);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.dot {
  color: #dcdee0;
}

.fab {
  position: fixed;
  right: 16px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 52px;
  height: 52px;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(245, 176, 66, 0.4);
  background: var(--accent-color) !important;
  border: none !important;
}

.fab :deep(.van-icon) {
  font-size: 24px;
  color: white;
}

.empty-state {
  padding: 60px 0;
}
</style>
