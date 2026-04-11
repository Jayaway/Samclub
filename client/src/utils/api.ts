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
  total_quantity: number;
  remaining_quantity: number;
  is_split_allowed: boolean;
  is_frozen: boolean;
  unit_price: number;
}

export interface OrderItem {
  id: number;
  group_buy_id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  subtotal: number;
  product_name?: string;
  is_frozen?: boolean;
  user_name?: string;
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
  has_frozen?: boolean;
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
  has_frozen: boolean;
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

export async function register(studentId: string, nickname: string, dormBuilding: string = ''): Promise<User> {
  const res = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId,
      nickname,
      dorm_building: dormBuilding,
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
}): Promise<OrderItem> {
  const res = await fetch(`${API_BASE}/order-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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
