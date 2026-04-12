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
  has_frozen?: boolean;
  progress?: number;
  total_amount?: number;
}

export interface Product {
  id: number;
  name: string;
  unitPrice: number;
  category?: string;
  remaining: number;
  total: number;
  isFresh: boolean;
  quantity: number;
  is_frozen?: boolean;
  is_split_allowed?: boolean;
  unit_price?: number;
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
