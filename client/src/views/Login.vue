<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo-icon">
        <van-icon name="shopping-cart" />
      </div>
      <h1 class="app-name">校园山姆拼单</h1>
      <p class="app-desc">平台统一下单 · 满99元免运费</p>
    </div>

    <div class="login-form">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="form.studentId"
            label="学号"
            placeholder="请输入学号"
            :rules="[{ required: true, message: '请输入学号' }]"
          />
          <van-field
            v-model="form.nickname"
            label="昵称"
            placeholder="请输入昵称"
            :rules="[{ required: true, message: '请输入昵称' }]"
          />
        </van-cell-group>

        <div class="form-tips">
          <van-icon name="info-o" />
          <span>首次登录将自动注册</span>
        </div>

        <div class="btn-group">
          <van-button type="primary" native-type="submit" block :loading="loading">
            登录 / 注册
          </van-button>
        </div>
      </van-form>
    </div>

    <div class="login-footer">
      <p class="footer-text">登录即表示同意</p>
      <p class="footer-link">《用户服务协议》</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

const form = ref({
  studentId: '',
  nickname: ''
});

const loading = ref(false);

async function handleSubmit() {
  if (!form.value.studentId || !form.value.nickname) {
    showToast('请填写学号和昵称');
    return;
  }

  loading.value = true;
  try {
    // Try login first
    try {
      await userStore.login(form.value.studentId);
      showToast('登录成功');
    } catch (e) {
      // If login fails, try register
      if (e.response?.status === 401) {
        await userStore.register(form.value.studentId, form.value.nickname, '');
        showToast('注册成功');
      } else {
        throw e;
      }
    }
    router.push('/square');
  } catch (e) {
    showToast(e.response?.data?.error || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px;
}

.login-header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
}

.logo-icon {
  width: 72px;
  height: 72px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.logo-icon :deep(.van-icon) {
  font-size: 36px;
  color: white;
}

.app-name {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.app-desc {
  font-size: 14px;
  opacity: 0.9;
}

.login-form {
  background: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

.form-tips {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 16px;
}

.btn-group {
  margin-top: 16px;
}

.login-footer {
  text-align: center;
  margin-top: 32px;
  color: rgba(255, 255, 255, 0.8);
}

.footer-text {
  font-size: 12px;
  margin-bottom: 4px;
}

.footer-link {
  font-size: 12px;
  color: var(--accent-color);
}
</style>
