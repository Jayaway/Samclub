import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Page, GroupBuy, User } from './types';
import { fetchGroupBuys, getUser, saveUser, login, register, clearUser, setToken, clearToken, ApiUser } from './utils/api';
import { springBouncy, overlayVariants, modalVariants } from './utils/animations';

import LoginPage from './pages/LoginPage';
import SquarePage from './pages/SquarePage';
import ShopPage from './pages/ShopPage';
import CreatePage from './pages/CreatePage';
import DetailPage from './pages/DetailPage';
import ProfilePage from './pages/ProfilePage';
import MyPage from './pages/MyPage';
import BottomNav from './components/BottomNav';
import PaymentCallbackPage from './pages/PaymentCallbackPage';

const SHOW_NAV_PAGES: Page[] = ['square', 'create', 'my', 'profile'];

// Map backend status to frontend status
function mapStatus(status: string): 'active' | 'completed' | 'expired' {
  if (status === '进行中' || status === '拼单中') return 'active';
  if (status === '已完成') return 'completed';
  if (status === '已下单' || status === '已送达' || status === '待付款') return 'completed';
  return 'expired';
}

// Map backend group to frontend group
function mapGroup(g: any): GroupBuy {
  return {
    id: g.id,
    title: g.title,
    creator: g.leader_name || '未知',
    creatorAvatar: (g.leader_name || 'U').charAt(0),
    creator_id: g.creator_id,
    currentAmount: g.total_amount || 0,
    targetAmount: 99,
    deadline: g.deadline,
    participants: (g.members || []).map((m: any) => ({
      id: m.id,
      name: m.nickname || '未知',
      avatar: (m.nickname || 'U').charAt(0),
      amount: 0,
    })),
    status: mapStatus(g.status),
    pickupLocation: g.pickup_location || '待定',
    hot: (g.progress || 0) >= 100,
    needs_cold_chain: g.needs_cold_chain,
    progress: g.progress,
    total_amount: g.total_amount,
  };
}

export default function App() {
  const [page, setPage] = useState<Page>(getUser() ? 'square' : 'square'); // 默认进入广场，不再强制登录
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(getUser());
  const [groups, setGroups] = useState<GroupBuy[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false); // 登录弹窗
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null); // 登录后要执行的操作
  const [loginError, setLoginError] = useState('');

  // Handle Alipay return URL
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/payment-callback' || path === '/payment-result') {
      setPage('payment-callback');
    }
  }, []);

  const navigate = useCallback((target: Page, id?: number | string) => {
    if (id !== undefined) setSelectedGroupId(Number(id));
    setPage(target);
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchGroupBuys();
      setGroups(data.map(mapGroup));
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 无论是否登录都加载拼单列表
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // 要求登录的函数：弹出登录弹窗，记录登录后要执行的操作
  const requireLogin = useCallback((action?: () => void) => {
    setPendingAction(() => action || null);
    setShowLoginModal(true);
    setLoginError('');
  }, []);

  const handleLogin = async (studentId: string, nickname?: string, dormBuilding?: string, phone?: string, code?: string, avatarUrl?: string) => {
    try {
      setLoginError('');
      let result: { token: string; user: ApiUser };

      if (nickname) {
        // 注册模式：有昵称说明是注册
        result = await register(studentId, nickname, dormBuilding, phone, code, avatarUrl);
      } else {
        // 登录模式：只需学号
        result = await login(studentId);
      }

      setToken(result.token);
      saveUser(result.user);
      setUser({
        id: result.user.id,
        student_id: result.user.student_id,
        nickname: result.user.nickname,
        avatar: result.user.avatar,
        dorm_building: result.user.dorm_building,
      });
      setShowLoginModal(false);
      
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLoginError(err.message);
      } else {
        setLoginError('操作失败');
      }
      throw err;
    }
  };

  const handleLogout = () => {
    clearToken();
    clearUser();
    setUser(null);
    setPage('square'); // 退出登录后回到广场
  };

  const handleGroupCreated = () => {
    loadGroups();
    navigate('square');
  };

  // 处理需要登录的导航
  const handleProtectedNavigate = useCallback((target: Page, id?: number | string) => {
    const protectedPages: Page[] = ['create', 'my', 'profile', 'shop'];
    if (protectedPages.includes(target) && !user) {
      requireLogin(() => {
        if (id !== undefined) setSelectedGroupId(Number(id));
        setPage(target);
      });
      return;
    }
    navigate(target, id);
  }, [user, navigate, requireLogin]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];
  const showNav = SHOW_NAV_PAGES.includes(page);

  // 登录弹窗组件
  const loginModal = (
    <AnimatePresence>
      {showLoginModal && (
        <>
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLoginModal(false)}
          />
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl p-5 max-w-md mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#0c0c0c]">请先登录</h2>
              <button
                onClick={() => setShowLoginModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <LoginPage
              onLogin={handleLogin}
              error={loginError}
              compact
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (page === 'square') {
    return (
      <>
        <SquarePage
          groups={groups}
          loading={loading}
          onNavigate={handleProtectedNavigate}
          onRefresh={loadGroups}
        />
        {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
        {loginModal}
      </>
    );
  }

  if (page === 'shop' && selectedGroup) {
    // 未登录时弹出登录
    if (!user) {
      requireLogin(() => setPage('shop'));
      setPage('detail');
      return null;
    }
    return (
      <>
        <ShopPage
          groupId={selectedGroup.id}
          userId={user.id}
          onBack={() => navigate('detail', selectedGroup.id)}
          onConfirm={() => {
            loadGroups();
            navigate('detail', selectedGroup.id);
          }}
        />
        {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
      </>
    );
  }

  if (page === 'create') {
    // 未登录时弹出登录
    if (!user) {
      requireLogin(() => setPage('create'));
      setPage('square');
      return null;
    }
    return (
      <>
        <CreatePage
          userId={user.id}
          onBack={() => navigate('square')}
          onCreated={handleGroupCreated}
        />
        {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
      </>
    );
  }

  if (page === 'detail' && selectedGroup) {
    return (
      <>
        <DetailPage
          group={selectedGroup}
          userId={user?.id}
          onBack={() => navigate('square')}
          onJoin={() => {
            if (!user) {
              requireLogin(() => navigate('shop', selectedGroup.id));
            } else {
              navigate('shop', selectedGroup.id);
            }
          }}
          onRequireLogin={requireLogin}
        />
        {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
        {loginModal}
      </>
    );
  }

  if (page === 'my') {
    // 未登录时弹出登录
    if (!user) {
      requireLogin(() => setPage('my'));
      setPage('square');
      return null;
    }
    return (
      <>
        <MyPage
          userId={user.id}
          onBack={() => navigate('profile')}
          onNavigate={navigate}
        />
        {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
      </>
    );
  }

  if (page === 'profile') {
    // 未登录时弹出登录
    if (!user) {
      requireLogin(() => setPage('profile'));
      setPage('square');
      return null;
    }
    return (
      <>
        <ProfilePage
          user={user}
          onLogout={handleLogout}
          onNavigate={navigate}
        />
        {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
      </>
    );
  }

  if (page === 'payment-callback') {
    return <PaymentCallbackPage />;
  }

  return (
    <div className="max-w-md mx-auto min-h-screen relative">
      <SquarePage
        groups={groups}
        loading={loading}
        onNavigate={handleProtectedNavigate}
        onRefresh={loadGroups}
      />
      {showNav && <BottomNav current={page} onNavigate={handleProtectedNavigate} />}
      {loginModal}
    </div>
  );
}
