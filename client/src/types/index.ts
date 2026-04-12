export type Page = 'login' | 'square' | 'shop' | 'create' | 'detail' | 'profile' | 'my';

export type GroupStatus = 'active' | 'completed' | 'expired';

export interface Participant {
  id: number;
  name: string;
  avatar: string;
  amount: number;
  paid?: boolean;
  isLeader?: boolean;
}

export interface GroupBuy {
  id: number;
  title: string;
  creator: string;
  creatorAvatar: string;
  creator_id?: number;
  currentAmount: number;
  targetAmount: number;
  deadline: string;
  participants: Participant[];
  status: GroupStatus;
  pickupLocation: string;
  hot?: boolean;
  needs_cold_chain?: boolean;
  progress?: number;
  total_amount?: number;
}

export interface Product {
  id: number;
  name: string;
  unitPrice: number; // 整份单价（元）
  category?: string;
  remaining: number; // 剩余可购数量
  quantity: number; // 整份数量
  isFresh: boolean;
  needs_cold_chain?: boolean;
  allow_split?: boolean; // 是否允许拆分
  unit_price?: number; // 整份单价（元）
  split_unit?: string; // 拆分单位（片/个）
  split_quantity_per_whole?: number; // 每整份含拆分单位数
  split_price_per_unit?: number; // 拆分单价（分）
  self_retain_quantity?: number; // 发起人自留数量
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface User {
  id: number;
  student_id: string;
  nickname: string;
  avatar?: string;
  dorm_building?: string;
  phone?: string;
}
