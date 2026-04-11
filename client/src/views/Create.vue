<template>
  <div class="page-container">
    <!-- 顶部导航 -->
    <div class="top-header">
      <van-nav-bar
        title="发起拼单"
        left-text="返回"
        @click-left="goBack"
      />
    </div>

    <div class="page-content">
      <van-form @submit="handleSubmit">
        <!-- 取货信息 -->
        <div class="card">
          <div class="card-title-row">
            <van-icon name="location-o" />
            <span>取货信息</span>
          </div>

          <van-field
            v-model="form.pickup_location"
            label="取货地点"
            placeholder="如：1号楼大厅"
          />

          <van-field
            v-model="form.deadline"
            is-link
            readonly
            label="截止时间"
            placeholder="选择截止时间"
            @click="showDeadlinePicker = true"
          />
        </div>

        <!-- 商品清单 -->
        <div class="section-header">
          <div class="section-title">
            <van-icon name="shopping-cart-o" />
            <span>拼单商品</span>
          </div>
        </div>

        <div class="product-list">
          <div v-for="(product, index) in form.products" :key="index" class="product-card">
            <div class="product-header">
              <span class="product-name">{{ product.name }}</span>
              <van-icon name="cross" @click="removeProduct(index)" />
            </div>
            <div class="product-meta">
              <span>¥{{ product.original_price.toFixed(2) }}</span>
              <span class="dot">·</span>
              <span>{{ product.total_quantity }}个</span>
              <span class="dot" v-if="product.is_split_allowed">·</span>
              <span v-if="product.is_split_allowed">可拆卖</span>
              <span class="dot" v-if="product.is_frozen">·</span>
              <span v-if="product.is_frozen" class="frozen-tag">
                <van-icon name="snowflake-o" />
                生鲜
              </span>
            </div>
            <div class="product-unit">
              单价：¥{{ product.unit_price.toFixed(2) }}/个
            </div>
          </div>

          <div class="add-product-btn" @click="showProductForm = true">
            <van-icon name="plus" />
            <span>添加商品</span>
          </div>
        </div>

        <!-- 费用预估 -->
        <div class="card cost-preview" v-if="form.products.length > 0">
          <div class="cost-row">
            <span>商品总价</span>
            <span>¥{{ totalProductAmount.toFixed(2) }}</span>
          </div>
          <div class="cost-row">
            <span>包装费</span>
            <span v-if="totalProductAmount >= 99">¥1.00</span>
            <span v-else>¥1.20</span>
          </div>
          <div class="cost-row" v-if="hasFrozenProduct">
            <span>
              生鲜附加费
              <van-icon name="snowflake-o" style="color: var(--frozen-color);" />
            </span>
            <span>+ ¥2.00</span>
          </div>
          <div class="cost-row">
            <span>平台服务费</span>
            <span>+ ¥0.50</span>
          </div>
          <div class="cost-row total">
            <span>预估总费用</span>
            <span class="amount">¥{{ estimatedTotalCost.toFixed(2) }}</span>
          </div>
          <div class="cost-status" :class="{ 'is-free': totalProductAmount >= 99 }">
            <van-icon :name="totalProductAmount >= 99 ? 'success' : 'warning-o'" />
            <span v-if="totalProductAmount >= 99">已满99元，免运费！</span>
            <span v-else>还差 ¥{{ (99 - totalProductAmount).toFixed(2) }} 免运费</span>
          </div>
        </div>

        <!-- 提交按钮 -->
        <div class="submit-area">
          <van-button
            type="primary"
            native-type="submit"
            block
            :loading="loading"
            :disabled="form.products.length === 0"
          >
            发布拼单
          </van-button>
        </div>
      </van-form>
    </div>

    <!-- 截止时间选择 -->
    <van-popup v-model:show="showDeadlinePicker" position="bottom">
      <div class="datetime-popup">
        <div class="datetime-header">
          <span>选择截止时间</span>
          <van-button type="primary" size="small" @click="confirmDeadline">确定</van-button>
        </div>
        <input
          type="datetime-local"
          v-model="deadlineInput"
          :min="minDateStr"
          step="900"
          class="datetime-input"
        />
      </div>
    </van-popup>

    <!-- 添加商品弹窗 -->
    <van-popup v-model:show="showProductForm" position="bottom" round>
      <div class="product-form">
        <div class="form-header">
          <span>添加商品</span>
          <van-icon name="cross" @click="showProductForm = false" />
        </div>
        <van-form @submit="addProduct">
          <van-cell-group inset>
            <van-field
              v-model="productForm.name"
              label="商品名称"
              placeholder="如：瑞士卷"
              :rules="[{ required: true, message: '请输入商品名称' }]"
            />
            <van-field
              v-model.number="productForm.original_price"
              type="number"
              label="总价"
              placeholder="如：128"
              :rules="[{ required: true, message: '请输入总价' }]"
            />
            <van-field
              v-model.number="productForm.total_quantity"
              type="number"
              label="数量"
              placeholder="如：12"
              :rules="[{ required: true, message: '请输入数量' }]"
            />
            <van-field name="is_split_allowed" label="允许拆卖">
              <template #input>
                <van-switch v-model="productForm.is_split_allowed" />
              </template>
            </van-field>
            <van-field name="is_frozen" label="生鲜商品">
              <template #input>
                <van-switch v-model="productForm.is_frozen" />
              </template>
            </van-field>
          </van-cell-group>
          <div class="form-btns">
            <van-button @click="showProductForm = false">取消</van-button>
            <van-button type="primary" native-type="submit">添加</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 底部导航 -->
    <div class="bottom-nav">
      <div class="bottom-nav-item" @click="goSquare">
        <van-icon name="shop-o" />
        <span>拼单广场</span>
      </div>
      <div class="bottom-nav-item active">
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
import { showToast, showSuccessToast } from 'vant';
import { useUserStore } from '../stores/user';
import { useGroupBuyStore } from '../stores/groupBuy';

const router = useRouter();
const userStore = useUserStore();
const groupBuyStore = useGroupBuyStore();

const form = ref({
  pickup_location: '',
  deadline: '',
  products: []
});

const productForm = ref({
  name: '',
  original_price: null,
  total_quantity: null,
  is_split_allowed: false,
  is_frozen: false
});

const showDeadlinePicker = ref(false);
const showProductForm = ref(false);
const loading = ref(false);

// 截止时间默认两天后，每15分钟为一个刻度
const now = new Date();
const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
// 四舍五入到最近的15分钟
const minutes = twoDaysLater.getMinutes();
twoDaysLater.setMinutes(Math.round(minutes / 15) * 15);
twoDaysLater.setSeconds(0);
const minDateStr = now.toISOString().slice(0, 16);
const deadlineInput = ref(twoDaysLater.toISOString().slice(0, 16));

const totalProductAmount = computed(() => {
  return form.value.products.reduce((sum, p) => sum + p.original_price, 0);
});

const hasFrozenProduct = computed(() => {
  return form.value.products.some(p => p.is_frozen);
});

const estimatedTotalCost = computed(() => {
  const amount = totalProductAmount.value;
  let cost = amount;
  cost += amount >= 99 ? 1 : 1.2; // packaging
  if (hasFrozenProduct.value) cost += 2; // frozen fee
  cost += 0.5; // platform fee
  return cost;
});

// 页面加载时自动填充取货地点为用户宿舍
onMounted(() => {
  if (userStore.user?.dorm_building) {
    form.value.pickup_location = userStore.user.dorm_building;
  }
});

function confirmDeadline() {
  if (deadlineInput.value) {
    const d = new Date(deadlineInput.value);
    // 四舍五入到最近的15分钟
    const mins = d.getMinutes();
    d.setMinutes(Math.round(mins / 15) * 15);
    d.setSeconds(0);
    form.value.deadline = d.toISOString();
    deadlineInput.value = d.toISOString().slice(0, 16);
  }
  showDeadlinePicker.value = false;
}

function addProduct() {
  if (!productForm.value.name || !productForm.value.original_price || !productForm.value.total_quantity) {
    showToast('请填写完整信息');
    return;
  }

  const unitPrice = productForm.value.original_price / productForm.value.total_quantity;

  form.value.products.push({
    name: productForm.value.name,
    original_price: productForm.value.original_price,
    total_quantity: productForm.value.total_quantity,
    is_split_allowed: productForm.value.is_split_allowed,
    is_frozen: productForm.value.is_frozen,
    unit_price: parseFloat(unitPrice.toFixed(2))
  });

  productForm.value = {
    name: '',
    original_price: null,
    total_quantity: null,
    is_split_allowed: false,
    is_frozen: false
  };

  showProductForm.value = false;
}

function removeProduct(index) {
  form.value.products.splice(index, 1);
}

async function handleSubmit() {
  if (form.value.products.length === 0) {
    showToast('请添加至少一个商品');
    return;
  }

  if (!form.value.deadline) {
    showToast('请选择截止时间');
    return;
  }

  // 标题使用第一个商品的名称
  const title = form.value.products[0].name + (form.value.products.length > 1 ? '等' : '');

  loading.value = true;
  try {
    const data = {
      creator_id: userStore.user.id,
      title: title,
      deadline: form.value.deadline,
      pickup_location: form.value.pickup_location,
      products: form.value.products
    };

    const result = await groupBuyStore.createGroupBuy(data);
    showSuccessToast('创建成功');
    router.push(`/detail/${result.id}`);
  } catch (e) {
    showToast(e.response?.data?.error || '创建失败');
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.back();
}

function goSquare() {
  router.push('/square');
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
  padding-bottom: calc(70px + env(safe-area-inset-bottom));
}

.top-header {
  background: white;
}

.page-content {
  padding: 12px;
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

.section-header {
  padding: 0 4px;
  margin: 16px 0 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.product-list {
  padding: 0 4px;
}

.product-card {
  background: white;
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin-bottom: 8px;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.product-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.dot {
  color: #dcdee0;
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

.product-unit {
  font-size: 12px;
  color: var(--primary-color);
}

.add-product-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: 2px dashed #dcdee0;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
}

.cost-preview {
  margin-top: 12px;
}

.cost-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
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
  font-size: 18px;
}

.cost-status {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  padding: 10px;
  margin-top: 10px;
  background: #fff5f5;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--danger-color);
}

.cost-status.is-free {
  background: #f0fff4;
  color: var(--success-color);
}

.submit-area {
  margin-top: 16px;
}

.datetime-popup {
  padding: 16px;
}

.datetime-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.datetime-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 16px;
  background: white;
}

.product-form {
  padding: 16px;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 16px;
  font-weight: 600;
}

.form-btns {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.form-btns button {
  flex: 1;
}
</style>
