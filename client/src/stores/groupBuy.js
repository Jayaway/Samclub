import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

const API_BASE = '/api';

export const useGroupBuyStore = defineStore('groupBuy', () => {
  const groupBuys = ref([]);
  const currentGroupBuy = ref(null);
  const loading = ref(false);

  async function fetchGroupBuys(params = {}) {
    loading.value = true;
    try {
      const res = await axios.get(`${API_BASE}/group-buys`, { params });
      groupBuys.value = res.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchGroupBuyById(id) {
    loading.value = true;
    try {
      const res = await axios.get(`${API_BASE}/group-buys/${id}`);
      currentGroupBuy.value = res.data;
      return res.data;
    } finally {
      loading.value = false;
    }
  }

  async function createGroupBuy(data) {
    const res = await axios.post(`${API_BASE}/group-buys`, data);
    return res.data;
  }

  async function updateGroupBuyStatus(id, status) {
    const res = await axios.put(`${API_BASE}/group-buys/${id}/status`, { status });
    return res.data;
  }

  async function deleteGroupBuy(id) {
    await axios.delete(`${API_BASE}/group-buys/${id}`);
  }

  async function addProduct(data) {
    const res = await axios.post(`${API_BASE}/products`, data);
    return res.data;
  }

  async function deleteProduct(id) {
    await axios.delete(`${API_BASE}/products/${id}`);
  }

  async function addOrderItem(data) {
    const res = await axios.post(`${API_BASE}/order-items`, data);
    return res.data;
  }

  async function removeOrderItem(id) {
    await axios.delete(`${API_BASE}/order-items/${id}`);
  }

  async function fetchCostDetails(groupBuyId) {
    const res = await axios.get(`${API_BASE}/group-buys/${groupBuyId}/cost-details`);
    return res.data;
  }

  async function submitPayment(data) {
    const res = await axios.post(`${API_BASE}/payments`, data);
    return res.data;
  }

  async function confirmPayment(id, status) {
    const res = await axios.put(`${API_BASE}/payments/${id}/confirm`, { status });
    return res.data;
  }

  async function batchConfirmPayments(paymentIds, status) {
    const res = await axios.post(`${API_BASE}/payments/batch-confirm`, {
      payment_ids: paymentIds,
      status
    });
    return res.data;
  }

  async function fetchPayments(groupBuyId) {
    const res = await axios.get(`${API_BASE}/payments/group/${groupBuyId}`);
    return res.data;
  }

  return {
    groupBuys,
    currentGroupBuy,
    loading,
    fetchGroupBuys,
    fetchGroupBuyById,
    createGroupBuy,
    updateGroupBuyStatus,
    deleteGroupBuy,
    addProduct,
    deleteProduct,
    addOrderItem,
    removeOrderItem,
    fetchCostDetails,
    submitPayment,
    confirmPayment,
    batchConfirmPayments,
    fetchPayments
  };
});
