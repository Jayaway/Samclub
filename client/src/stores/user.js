import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

const API_BASE = '/api';

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
  const token = ref(localStorage.getItem('token') || '');

  const isLoggedIn = computed(() => !!user.value);

  async function login(studentId) {
    const res = await axios.post(`${API_BASE}/users/login`, { student_id: studentId });
    user.value = res.data;
    localStorage.setItem('user', JSON.stringify(res.data));
    localStorage.setItem('token', res.data.id.toString());
    axios.defaults.headers.common['x-user-id'] = res.data.id;
    return res.data;
  }

  async function register(studentId, nickname, dormBuilding) {
    const res = await axios.post(`${API_BASE}/users/register`, {
      student_id: studentId,
      nickname,
      dorm_building: dormBuilding
    });
    user.value = res.data;
    localStorage.setItem('user', JSON.stringify(res.data));
    localStorage.setItem('token', res.data.id.toString());
    axios.defaults.headers.common['x-user-id'] = res.data.id;
    return res.data;
  }

  function logout() {
    user.value = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['x-user-id'];
  }

  // 初始化 axios headers
  if (user.value) {
    axios.defaults.headers.common['x-user-id'] = user.value.id;
  }

  return { user, token, isLoggedIn, login, register, logout };
});
