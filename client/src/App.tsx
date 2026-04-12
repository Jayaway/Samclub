import { useState, useEffect, useCallback } from 'react';
import { Page, GroupBuy, User } from './types';
import { fetchGroupBuys, getUser, saveUser, login, register, clearUser } from './utils/api';

import LoginPage from './pages/LoginPage';
import SquarePage from './pages/SquarePage';
import ShopPage from './pages/ShopPage';
import CreatePage from './pages/CreatePage';
import DetailPage from './pages/DetailPage';
import ProfilePage from './pages/ProfilePage';
import MyPage from './pages/MyPage';
import BottomNav from './components/BottomNav';

const SHOW_NAV_PAGES: Page[] = ['square', 'create', 'my', 'profile'];

// Map backend status to frontend status
function mapStatus(status: string): 'active' | 'completed' | 'expired' {
  if (status === '进行中' || status === '拼单中') return 'active';
  if (status === '已完成' || status === '已下单' || status === '已送达' || status === '待付款') return 'completed';
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
  const [page, setPage] = useState<Page>('login');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(getUser());
  const [groups, setGroups] = useState<GroupBuy[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user, loadGroups]);

  const handleLogin = async (studentId: string, nickname: string, dormBuilding?: string) => {
    try {
      let loggedInUser: User;
      try {
        loggedInUser = await login(studentId);
      } catch {
        // Login failed, try register
        loggedInUser = await register(studentId, nickname, dormBuilding);
      }
      saveUser(loggedInUser);
      setUser(loggedInUser);
      navigate('square');
    } catch (err: any) {
      throw err;
    }
  };

  const handleLogout = () => {
    clearUser();
    setUser(null);
    setPage('login');
  };

  const handleGroupCreated = () => {
    loadGroups();
    navigate('square');
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];
  const showNav = SHOW_NAV_PAGES.includes(page);

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (page === 'square') {
    return (
      <>
        <SquarePage
          groups={groups}
          loading={loading}
          onNavigate={navigate}
          onRefresh={loadGroups}
        />
        {showNav && <BottomNav current={page} onNavigate={navigate} />}
      </>
    );
  }

  if (page === 'shop' && selectedGroup) {
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
        {showNav && <BottomNav current={page} onNavigate={navigate} />}
      </>
    );
  }

  if (page === 'create') {
    return (
      <>
        <CreatePage
          userId={user.id}
          onBack={() => navigate('square')}
          onCreated={handleGroupCreated}
        />
        {showNav && <BottomNav current={page} onNavigate={navigate} />}
      </>
    );
  }

  if (page === 'detail' && selectedGroup) {
    return (
      <>
        <DetailPage
          group={selectedGroup}
          userId={user.id}
          onBack={() => navigate('square')}
          onJoin={() => navigate('shop', selectedGroup.id)}
        />
        {showNav && <BottomNav current={page} onNavigate={navigate} />}
      </>
    );
  }

  if (page === 'my') {
    return (
      <>
        <MyPage
          userId={user.id}
          onBack={() => navigate('profile')}
          onNavigate={navigate}
        />
        {showNav && <BottomNav current={page} onNavigate={navigate} />}
      </>
    );
  }

  if (page === 'profile') {
    return (
      <>
        <ProfilePage
          user={user}
          onLogout={handleLogout}
          onNavigate={navigate}
        />
        {showNav && <BottomNav current={page} onNavigate={navigate} />}
      </>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen relative">
      <SquarePage
        groups={groups}
        loading={loading}
        onNavigate={navigate}
        onRefresh={loadGroups}
      />
      {showNav && <BottomNav current={page} onNavigate={navigate} />}
    </div>
  );
}
