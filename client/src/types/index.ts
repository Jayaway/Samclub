export type Page = 'login' | 'square' | 'shop' | 'create' | 'detail' | 'profile' | 'my' | 'payment-callback';

export type GroupStatus = 'active' | 'completed' | 'expired';

export interface Participant {
  id: number;
  name: string;
  avatar: string;
  amount: number;
  paid?: boolean;
  isLeader?: boolean;
}

// 前端UI用的 GroupBuy（用于 SquarePage、DetailPage 等）
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
  unitPrice: number;
  category?: string;
  remaining: number;
  quantity: number;
  isFresh: boolean;
  needs_cold_chain?: boolean;
  allow_split?: boolean;
  unit_price?: number;
  split_unit?: string;
  split_quantity_per_whole?: number;
  split_price_per_unit?: number;
  self_retain_quantity?: number;
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
