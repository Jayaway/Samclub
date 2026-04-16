const API_BASE = '/api';

// ============ 后端API类型定义（仅API层使用）============
export interface ApiUser {
  id: number;
  student_id: string;
  nickname: string;
  avatar: string;
  dorm_building: string;
  credit_score: number;
}

export interface ApiProduct {
  id: number;
  group_buy_id: number;
  name: string;
  original_price: number;
  quantity: number;
  remaining_quantity: number;
  allow_split: number;
  split_unit: string;
  split_quantity_per_whole: number;
  split_price_per_unit: number;
  self_retain_quantity: number;
  needs_cold_chain: number;
  unit_price: number;
  product_type: string;
  split_remaining_quantity?: number;
}

export interface ApiOrderItem {
  id: number;
  group_buy_id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  subtotal: number;
  purchase_type?: 'whole' | 'split';
  product_name?: string;
  needs_cold_chain?: number;
  user_name?: string;
  split_remaining_quantity?: number;
  allow_split?: number;
}

export interface ApiCostDetail {
  id: number;
  group_buy_id: number;
  user_id: number;
  base_amount: number;
  share_fee: number;
  leader_discount: number;
  final_amount: number;
  paid_status: string;
  user_name?: string;
}

export interface ApiGroupBuy {
  id: number;
  creator_id: number;
  title: string;
  deadline: string;
  status: string;
  pickup_location: string;
  total_amount: number;
  leader_name?: string;
  leader_avatar?: string;
  member_count?: number;
  needs_cold_chain?: boolean;
  progress?: number;
  total_cost?: number;
  delivery_mode?: string;
  products?: ApiProduct[];
  orderItems?: ApiOrderItem[];
  costDetails?: ApiCostDetail[];
  members?: { id: number; nickname: string; avatar: string }[];
  payment_remark?: string;
  delivered_at?: string;
}

export interface CostDetailsResponse {
  costDetails: ApiCostDetail[];
  totalCost: number;
  mode: string;
  needs_cold_chain: boolean;
  packaging: number;
  delivery: number;
  frozen: number;
  reward: number;
}

export interface PaymentInfo {
  payment_remark: string;
  qr_code_url: string;
  leader_name: string;
  leader_avatar: string;
  total_amount: number;
}

export interface PaymentProgressMember {
  user_id: number;
  user_name: string;
  user_avatar: string;
  should_pay: number;
  paid: boolean;
  paid_amount: number;
  paid_at: string | null;
}

export interface PaymentProgress {
  group_buy_id: number;
  title: string;
  status: string;
  total_amount: number;
  all_paid: boolean;
  members: PaymentProgressMember[];
}

export interface PaymentRecord {
  id: number;
  group_buy_id: number;
  user_id: number;
  amount: number;
  status: string;
  user_name?: string;
  user_avatar?: string;
}

export interface AlipayPayResult {
  payment_url: string;
  out_trade_no: string;
  device: 'mobile' | 'pc';
}

export interface Message {
  id: number;
  group_buy_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user_name: string;
  user_avatar: string;
}

// ============ Token 管理 ============
export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', 'Bearer ' + token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

// ============ 统一HTTP客户端 ============
const DEFAULT_TIMEOUT = 10000;

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token.replace('Bearer ', '');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      let errorMsg = '请求失败';
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch { /* ignore parse error */ }

      if (res.status === 401) {
        clearToken();
        clearUser();
        window.location.reload();
      }

      throw new Error(errorMsg);
    }

    return res.json();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时，请检查网络');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============ Auth API ============
// 发送验证码
export async function sendVerificationCode(phone: string): Promise<{ success: boolean; message: string; code?: string }> {
  return request('/users/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

// 登录（学号直接登录）
export async function login(studentId: string): Promise<{ token: string; user: ApiUser }> {
  return request('/users/login', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId }),
  });
}

// 注册（手机号选填，填了需要验证码）
export async function register(
  studentId: string, 
  nickname: string, 
  dormBuilding: string = '', 
  phone?: string, 
  code?: string, 
  avatar?: string
): Promise<{ token: string; user: ApiUser }> {
  return request('/users/register', {
    method: 'POST',
    body: JSON.stringify({
      student_id: studentId,
      nickname,
      dorm_building: dormBuilding,
      phone: phone || undefined,
      code: code || undefined,
      avatar,
    }),
  });
}

export async function getCurrentUser(): Promise<ApiUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    return await request<ApiUser>('/users/me');
  } catch {
    return null;
  }
}

// ============ Group Buys API ============
export async function fetchGroupBuys(status?: string): Promise<ApiGroupBuy[]> {
  const params = status ? `?status=${status}` : '';
  return request('/group-buys' + params);
}

export async function fetchJoinedGroupBuys(userId: number): Promise<ApiGroupBuy[]> {
  return request(`/group-buys/user/${userId}/joined`);
}

export async function fetchGroupBuyById(id: number): Promise<ApiGroupBuy> {
  return request(`/group-buys/${id}`);
}

export async function fetchPaymentInfo(groupId: number): Promise<PaymentInfo> {
  return request(`/group-buys/${groupId}/payment-info`);
}

export async function createGroupBuy(data: {
  creator_id: number;
  title: string;
  deadline: string;
  pickup_location: string;
  products: Omit<ApiProduct, 'id' | 'group_buy_id'>[];
}): Promise<ApiGroupBuy> {
  return request('/group-buys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGroupBuyStatus(id: number, status: string): Promise<ApiGroupBuy> {
  return request(`/group-buys/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function deleteGroupBuy(id: number): Promise<void> {
  await request(`/group-buys/${id}`, { method: 'DELETE' });
}

export async function checkDuplicateGroupBuy(keyword: string, deadline: string): Promise<{ similar: { id: number; title: string; deadline: string }[] }> {
  const params = new URLSearchParams({ check_keyword: keyword, check_deadline: deadline });
  return request('/group-buys?' + params.toString());
}

// ============ Order Items API ============
export async function fetchMyOrders(userId: number, groupBuyId: number): Promise<ApiOrderItem[]> {
  return request(`/order-items/user/${userId}/group/${groupBuyId}`);
}

export async function addOrderItem(data: {
  group_buy_id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_type?: 'whole' | 'split';
}): Promise<ApiOrderItem> {
  return request('/order-items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeOrderItem(id: number): Promise<void> {
  await request(`/order-items/${id}`, { method: 'DELETE' });
}

// ============ Cost Details API ============
export async function fetchCostDetails(groupBuyId: number): Promise<CostDetailsResponse> {
  return request(`/group-buys/${groupBuyId}/cost-details`);
}

// ============ Member Exit API ============
export async function exitGroupBuy(groupBuyId: number): Promise<{ success: boolean; message: string }> {
  return request(`/group-buys/${groupBuyId}/members/me`, {
    method: 'DELETE',
  });
}

// ============ Add Products API ============
export async function addProductsToGroupBuy(groupBuyId: number, products: Omit<ApiProduct, 'id' | 'group_buy_id'>[]): Promise<{ success: boolean; modeSwitch: boolean; modeSwitchWarning: string | null; newTotalAmount: number; newMode: string }> {
  return request(`/group-buys/${groupBuyId}/products`, {
    method: 'POST',
    body: JSON.stringify({ products }),
  });
}

// ============ Payments API ============
export async function submitPayment(data: {
  group_buy_id: number;
  user_id: number;
  amount: number;
  proof_image?: string;
}): Promise<void> {
  await request('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchPaymentProgress(groupId: number): Promise<PaymentProgress> {
  return request(`/group-buys/${groupId}/payment-progress`);
}

export async function confirmPayment(paymentId: number, status: '已确认' | '已拒绝'): Promise<void> {
  await request(`/payments/${paymentId}/confirm`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function batchConfirmPayments(paymentIds: number[], status: '已确认' | '已拒绝'): Promise<{ success: boolean; updated: number }> {
  return request('/payments/batch-confirm', {
    method: 'POST',
    body: JSON.stringify({ payment_ids: paymentIds, status }),
  });
}

export async function fetchPaymentsByGroup(groupId: number): Promise<PaymentRecord[]> {
  return request(`/payments/group/${groupId}`);
}

// ============ Alipay API ============
export async function alipayPay(data: {
  group_buy_id: number;
  user_id: number;
  amount: number;
  device?: 'auto' | 'mobile' | 'pc';
}): Promise<AlipayPayResult> {
  return request('/alipay/pay', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchAlipayStatus(outTradeNo: string): Promise<{
  out_trade_no: string;
  status: string;
  trade_no: string;
  amount: number;
}> {
  return request(`/alipay/status/${outTradeNo}`);
}

// ============ Messages API ============
export async function fetchMessages(groupId: number, page?: number, limit?: number): Promise<Message[]> {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return request(`/messages/${groupId}${qs ? '?' + qs : ''}`);
}

export async function sendMessage(groupId: number, content: string): Promise<Message> {
  return request('/messages', {
    method: 'POST',
    body: JSON.stringify({ group_buy_id: groupId, content }),
  });
}

// ============ Local Storage Helpers ============
export function saveUser(user: ApiUser): void {
  localStorage.setItem('userId', user.id.toString());
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser(): ApiUser | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function clearUser(): void {
  localStorage.removeItem('userId');
  localStorage.removeItem('user');
}
