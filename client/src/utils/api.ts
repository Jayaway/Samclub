const API_BASE = '/api';

// Types matching backend API
export interface User {
  id: number;
  student_id: string;
  nickname: string;
  avatar: string;
  dorm_building: string;
  credit_score: number;
}

export interface Product {
  id: number;
  group_buy_id: number;
  name: string;
  original_price: number;
  quantity: number; // 整份数量
  remaining_quantity: number;
  allow_split: boolean;
  split_unit: string;
  split_quantity_per_whole: number;
  split_price_per_unit: number;
  self_retain_quantity: number;
  needs_cold_chain: boolean;
  unit_price: number;
}

export interface OrderItem {
  id: number;
  group_buy_id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  subtotal: number;
  purchase_type?: 'whole' | 'split';
  product_name?: string;
  needs_cold_chain?: boolean;
  user_name?: string;
  split_remaining_quantity?: number;
  allow_split?: boolean;
}

export interface CostDetail {
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

export interface GroupBuy {
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
  products?: Product[];
  orderItems?: OrderItem[];
  costDetails?: CostDetail[];
  members?: { id: number; nickname: string; avatar: string }[];
}

export interface CostDetailsResponse {
  costDetails: CostDetail[];
  totalCost: number;
  mode: string;
  needs_cold_chain: boolean;
  packaging: number;
  delivery: number;
  frozen: number;
  reward: number;
}

// Auth
export async function login(studentId: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '登录失败');
  }
  return res.json();
}

export async function register(studentId: string, nickname: string, dormBuilding: string = '', phone?: string, avatar?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId,
      nickname,
      dorm_building: dormBuilding,
      phone,
      avatar,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '注册失败');
  }
  return res.json();
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = localStorage.getItem('userId');
  if (!userId) return null;
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { 'x-user-id': userId },
  });
  if (!res.ok) return null;
  return res.json();
}

// Group Buys
export async function fetchGroupBuys(status?: string): Promise<GroupBuy[]> {
  const params = status ? `?status=${status}` : '';
  const res = await fetch(`${API_BASE}/group-buys${params}`);
  return res.json();
}

export async function fetchGroupBuyById(id: number): Promise<GroupBuy> {
  const res = await fetch(`${API_BASE}/group-buys/${id}`);
  if (!res.ok) throw new Error('拼单不存在');
  return res.json();
}

export interface PaymentInfo {
  payment_remark: string;
  qr_code_url: string;
  leader_name: string;
  leader_avatar: string;
  total_amount: number;
}

export async function fetchPaymentInfo(groupId: number): Promise<PaymentInfo> {
  const res = await fetch(`${API_BASE}/group-buys/${groupId}/payment-info`);
  if (!res.ok) throw new Error('获取收款信息失败');
  return res.json();
}

export async function createGroupBuy(data: {
  creator_id: number;
  title: string;
  deadline: string;
  pickup_location: string;
  products: Omit<Product, 'id' | 'group_buy_id'>[];
}): Promise<GroupBuy> {
  const res = await fetch(`${API_BASE}/group-buys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '创建失败');
  }
  return res.json();
}

export async function updateGroupBuyStatus(id: number, status: string): Promise<GroupBuy> {
  const res = await fetch(`${API_BASE}/group-buys/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function deleteGroupBuy(id: number): Promise<void> {
  await fetch(`${API_BASE}/group-buys/${id}`, { method: 'DELETE' });
}

export async function checkDuplicateGroupBuy(keyword: string, deadline: string): Promise<{ similar: { id: number; title: string; deadline: string }[] }> {
  const params = new URLSearchParams({ check_keyword: keyword, check_deadline: deadline });
  const res = await fetch(`${API_BASE}/group-buys?${params}`);
  return res.json();
}

// Order Items
export async function fetchMyOrders(userId: number, groupBuyId: number): Promise<OrderItem[]> {
  const res = await fetch(`${API_BASE}/order-items/user/${userId}/group/${groupBuyId}`);
  return res.json();
}

export async function addOrderItem(data: {
  group_buy_id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_type?: 'whole' | 'split';
}): Promise<OrderItem> {
  const res = await fetch(`${API_BASE}/order-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '添加失败');
  }
  return res.json();
}

export async function removeOrderItem(id: number): Promise<void> {
  await fetch(`${API_BASE}/order-items/${id}`, { method: 'DELETE' });
}

// Cost Details
export async function fetchCostDetails(groupBuyId: number): Promise<CostDetailsResponse> {
  const res = await fetch(`${API_BASE}/group-buys/${groupBuyId}/cost-details`);
  return res.json();
}

// Member exits group buy
export async function exitGroupBuy(groupBuyId: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/group-buys/${groupBuyId}/members/me`, {
    method: 'DELETE',
    headers: { 'x-user-id': String(userId) },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '退出失败');
  }
}

// Creator adds products to existing group buy (triggers cost recalculation)
export async function addProductsToGroupBuy(groupBuyId: number, products: Omit<Product, 'id' | 'group_buy_id'>[]): Promise<GroupBuy> {
  const res = await fetch(`${API_BASE}/group-buys/${groupBuyId}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '添加商品失败');
  }
  return res.json();
}

// Payments
export async function submitPayment(data: {
  group_buy_id: number;
  user_id: number;
  amount: number;
  proof_image?: string;
}): Promise<void> {
  await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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

export async function fetchPaymentProgress(groupId: number): Promise<PaymentProgress> {
  const res = await fetch(`${API_BASE}/group-buys/${groupId}/payment-progress`);
  if (!res.ok) throw new Error('获取收款进度失败');
  return res.json();
}

export async function confirmPayment(paymentId: number, status: '已确认' | '已拒绝'): Promise<void> {
  await fetch(`${API_BASE}/payments/${paymentId}/confirm`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function batchConfirmPayments(paymentIds: number[], status: '已确认' | '已拒绝'): Promise<void> {
  await fetch(`${API_BASE}/payments/batch-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_ids: paymentIds, status }),
  });
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

export async function fetchPaymentsByGroup(groupId: number): Promise<PaymentRecord[]> {
  const res = await fetch(`${API_BASE}/payments/group/${groupId}`);
  return res.json();
}

// Messages
export interface Message {
  id: number;
  group_buy_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user_name: string;
  user_avatar: string;
}

export async function fetchMessages(groupId: number): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/messages/${groupId}`);
  return res.json();
}

export async function sendMessage(groupId: number, userId: number, content: string): Promise<Message> {
  const res = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_buy_id: groupId, user_id: userId, content }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || '发送留言失败');
  }
  return res.json();
}

// Local storage helpers
export function saveUser(user: User): void {
  localStorage.setItem('userId', user.id.toString());
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser(): User | null {
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
