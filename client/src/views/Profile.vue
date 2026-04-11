<template>
  <div class="page-container">
    <!-- 用户信息头部 -->
    <div class="profile-header">
      <div class="avatar-wrapper">
        <div class="avatar">
          {{ user?.nickname?.charAt(0) || '用户' }}
        </div>
      </div>
      <div class="user-info">
        <div class="user-name">{{ user?.nickname }}</div>
        <div class="user-id">学号：{{ user?.student_id }}</div>
      </div>
    </div>

    <div class="page-content">
      <!-- 菜单列表 -->
      <div class="menu-list">
        <div class="menu-item" @click="goMyPayments">
          <div class="menu-item-left">
            <van-icon name="paid" class="menu-icon" />
            <span>我的付款记录</span>
          </div>
          <van-icon name="arrow" class="menu-arrow" />
        </div>

        <div class="menu-item" @click="goMyGroupBuys">
          <div class="menu-item-left">
            <van-icon name="orders-o" class="menu-icon" />
            <span>我的拼单记录</span>
          </div>
          <van-icon name="arrow" class="menu-arrow" />
        </div>

        <div class="menu-item" @click="goHistory">
          <div class="menu-item-left">
            <van-icon name="clock-o" class="menu-icon" />
            <span>历史参与</span>
          </div>
          <van-icon name="arrow" class="menu-arrow" />
        </div>
      </div>

      <div class="menu-list">
        <div class="menu-item" @click="goHelp">
          <div class="menu-item-left">
            <van-icon name="question-o" class="menu-icon" />
            <span>帮助与反馈</span>
          </div>
          <van-icon name="arrow" class="menu-arrow" />
        </div>

        <div class="menu-item" @click="goAbout">
          <div class="menu-item-left">
            <van-icon name="info-o" class="menu-icon" />
            <span>关于我们</span>
          </div>
          <van-icon name="arrow" class="menu-arrow" />
        </div>
      </div>

      <!-- 退出登录 -->
      <div class="logout-area">
        <van-button type="danger" plain block @click="handleLogout">
          退出登录
        </van-button>
      </div>
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
      <div class="bottom-nav-item active">
        <van-icon name="user-o" />
        <span>个人中心</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

const user = computed(() => userStore.user);

function goSquare() {
  router.push('/square');
}

function goCreate() {
  router.push('/create');
}

function goMy() {
  router.push('/my');
}

function goMyPayments() {
  showToast('功能开发中');
}

function goMyGroupBuys() {
  router.push('/my');
}

function goHistory() {
  showToast('功能开发中');
}

function goHelp() {
  showToast('功能开发中');
}

function goAbout() {
  showToast('校园山姆拼单 v1.0');
}

function handleLogout() {
  userStore.logout();
  router.push('/login');
  showToast('已退出');
}
</script>

<style scoped>
.page-container {
  background: var(--bg-color);
  min-height: 100vh;
  padding-bottom: calc(70px + env(safe-area-inset-bottom));
}

.profile-header {
  background: var(--primary-color);
  padding: 32px 16px;
  color: white;
  text-align: center;
}

.avatar-wrapper {
  margin-bottom: 12px;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 600;
  margin: 0 auto;
  border: 3px solid rgba(255, 255, 255, 0.3);
}

.user-info {
  text-align: center;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.user-id {
  font-size: 13px;
  opacity: 0.9;
}

.page-content {
  padding: 12px;
}

.menu-list {
  background: white;
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
}

.menu-item:not(:last-child) {
  border-bottom: 1px solid var(--border-light);
}

.menu-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-icon {
  font-size: 20px;
  color: var(--primary-color);
}

.menu-item-left span {
  font-size: 15px;
  color: var(--text-primary);
}

.menu-arrow {
  font-size: 14px;
  color: var(--text-muted);
}

.logout-area {
  margin-top: 24px;
  padding: 0 4px;
}
</style>
