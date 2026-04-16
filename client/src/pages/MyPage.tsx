import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Clock, Users, CheckCircle, XCircle, ChevronRight, Grid2x2 } from 'lucide-react';
import { springConfig, springBouncy, springSnappy } from '../utils/animations';
import { fetchGroupBuys, fetchJoinedGroupBuys } from '../utils/api';
import { GroupBuy } from '../types';

interface MyPageProps {
  userId: number;
  onBack: () => void;
  onNavigate: (page: 'square' | 'detail', id?: number) => void;
}

interface MyGroupBuy {
  id: number;
  title: string;
  status: 'active' | 'completed' | 'expired';
  member_count: number;
  total_cost: number;
  isCreator: boolean;
}

export default function MyPage({ userId, onBack, onNavigate }: MyPageProps) {
  const [myGroups, setMyGroups] = useState<MyGroupBuy[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<MyGroupBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'created' | 'joined'>('created');

  useEffect(() => {
    async function loadMyGroups() {
      try {
        const [allGroups, joinedGroups] = await Promise.all([
          fetchGroupBuys(),
          fetchJoinedGroupBuys(userId),
        ]);
        const myCreated = allGroups
          .filter((g: any) => g.creator_id === userId)
          .map((g: any) => ({
            id: g.id,
            title: g.title,
            status: mapStatus(g.status),
            member_count: g.member_count || 0,
            total_cost: g.total_amount || 0,
            isCreator: true,
          }));
        const myJoined = joinedGroups
          .map((g: any) => ({
            id: g.id,
            title: g.title,
            status: mapStatus(g.status),
            member_count: g.member_count || 0,
            total_cost: g.total_amount || 0,
            isCreator: false,
          }));
        setMyGroups(myCreated);
        setJoinedGroups(myJoined);
      } catch (err) {
        console.error('Failed to load groups:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMyGroups();
  }, [userId]);

  function mapStatus(status: string): 'active' | 'completed' | 'expired' {
    if (status === '进行中' || status === '拼单中') return 'active';
    if (status === '已完成' || status === '已下单' || status === '已送达' || status === '待付款') return 'completed';
    return 'expired';
  }

  const displayedGroups = activeTab === 'created' ? myGroups : joinedGroups;

  const statusConfig = {
    active: { label: '拼单中', color: 'emerald', icon: Clock },
    completed: { label: '已完成', color: 'sky', icon: CheckCircle },
    expired: { label: '已失效', color: 'zinc', icon: XCircle },
  };

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springConfig}
        className="sticky top-0 z-20 bg-white border-b border-zinc-100 px-4 pt-12 pb-3 flex items-center gap-3"
      >
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          transition={springSnappy}
          className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600"
        >
          <ArrowLeft size={18} />
        </motion.button>
        <h1 className="text-[#0c0c0c] font-black text-lg flex-1">我的拼单</h1>
        <motion.button
          onClick={() => onNavigate('square')}
          whileTap={{ scale: 0.9 }}
          transition={springSnappy}
          className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600"
        >
          <Grid2x2 size={18} />
        </motion.button>
      </motion.div>

      {/* Tabs */}
      <div className="bg-white px-4 py-3 flex gap-2">
        <button
          onClick={() => setActiveTab('created')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'created'
              ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md'
              : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          我发起的 ({myGroups.length})
        </button>
        <button
          onClick={() => setActiveTab('joined')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'joined'
              ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md'
              : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          我参与的 ({joinedGroups.length})
        </button>
      </div>

      {/* Group List */}
      <div className="flex-1 px-4 pt-4 pb-24 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedGroups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={24} className="text-zinc-400" />
            </div>
            <p className="text-zinc-500 text-sm">
              {activeTab === 'created' ? '还没有发起过拼单' : '还没有参与过拼单'}
            </p>
            {activeTab === 'created' && (
              <button
                onClick={() => onNavigate('square')}
                className="mt-4 text-cyan-500 text-sm font-bold"
              >
                去发起一个
              </button>
            )}
          </motion.div>
        ) : (
          displayedGroups.map((group, i) => {
            const config = statusConfig[group.status];
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springConfig, delay: i * 0.05 }}
                onClick={() => onNavigate('detail', group.id)}
                className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  config.color === 'emerald' ? 'bg-emerald-100' :
                  config.color === 'sky' ? 'bg-sky-100' : 'bg-zinc-100'
                }`}>
                  <StatusIcon size={20} className={
                    config.color === 'emerald' ? 'text-emerald-500' :
                    config.color === 'sky' ? 'text-sky-500' : 'text-zinc-400'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#0c0c0c] font-bold text-sm truncate">{group.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      config.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                      config.color === 'sky' ? 'bg-sky-100 text-sky-600' : 'bg-zinc-100 text-zinc-400'
                    }`}>
                      {config.label}
                    </span>
                    <span className="text-zinc-400 text-[10px] flex items-center gap-0.5">
                      <Users size={10} />
                      {group.member_count}人
                    </span>
                    <span className="text-zinc-400 text-[10px]">
                      ¥{group.total_cost.toFixed(2)}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-300" />
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}