import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Clock, CheckCircle, XCircle, MapPin, Users, Loader2 } from 'lucide-react';
import { GroupBuy, Page } from '../types';
import { springConfig, springBouncy, staggerContainer, staggerItem } from '../utils/animations';
import cakeImg from '../assets/cake.png';

interface SquarePageProps {
  groups: GroupBuy[];
  loading?: boolean;
  onNavigate: (page: Page, id?: number | string) => void;
  onRefresh?: () => void;
}

const statusConfig = {
  active: {
    label: '拼单中',
    bg: 'bg-emerald-500',
    text: 'text-white',
    icon: <Clock size={10} />,
    borderColor: 'border-l-emerald-400',
    glowColor: 'shadow-emerald-500/10',
  },
  completed: {
    label: '已成团',
    bg: 'bg-sky-500',
    text: 'text-white',
    icon: <CheckCircle size={10} />,
    borderColor: 'border-l-sky-400',
    glowColor: 'shadow-sky-500/10',
  },
  expired: {
    label: '已截止',
    bg: 'bg-zinc-400',
    text: 'text-white',
    icon: <XCircle size={10} />,
    borderColor: 'border-l-zinc-400',
    glowColor: 'shadow-zinc-500/10',
  },
};

function formatDeadline(deadline: string, _tick?: number): string {
  if (!deadline) return '';
  try {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return '已截止';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}天后`;
    return `${hours}小时${minutes}分`;
  } catch {
    return deadline;
  }
}

function GroupCard({ group, onClick, index }: { group: GroupBuy; onClick: () => void; index: number }) {
  const cfg = statusConfig[group.status];
  const pct = Math.min(100, Math.round((group.currentAmount / group.targetAmount) * 100));
  const remaining = Math.max(0, group.targetAmount - group.currentAmount);
  const displayDeadline = formatDeadline(group.deadline);

  return (
    <motion.button
      onClick={onClick}
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      transition={springConfig}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left bg-white rounded-2xl shadow-md ${cfg.glowColor} shadow-lg border-l-4 ${cfg.borderColor} overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...springBouncy, delay: index * 0.05 }}
              className={`${cfg.bg} ${cfg.text} text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1`}
            >
              {cfg.icon}
              {cfg.label}
            </motion.span>
            {group.hot && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springBouncy, delay: index * 0.05 + 0.1 }}
                className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"
              >
                <Flame size={10} />
                HOT
              </motion.span>
            )}
          </div>
          {group.status === 'active' && displayDeadline && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springConfig, delay: index * 0.05 + 0.15 }}
              className="flex items-center gap-1 text-amber-600 text-xs font-semibold"
            >
              <Clock size={11} />
              <span>{displayDeadline}</span>
            </motion.div>
          )}
        </div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: index * 0.05 + 0.1 }}
          className="text-[#0c0c0c] font-black text-lg leading-tight mb-1"
        >
          {group.title}
        </motion.h3>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: index * 0.05 + 0.15 }}
          className="flex items-center gap-2 mb-3"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center text-white text-[10px] font-bold">
            {group.creatorAvatar}
          </div>
          <span className="text-zinc-500 text-xs">{group.creator} 发起</span>
          <span className="ml-auto flex items-center gap-1 text-zinc-400 text-xs">
            <MapPin size={10} />
            {group.pickupLocation}
          </span>
        </motion.div>

        {group.status === 'active' && remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springBouncy, delay: index * 0.05 + 0.2 }}
            className="flex items-center justify-center mb-3"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-2 text-center">
              <div className="text-amber-600 text-xs font-medium">还差</div>
              <div className="text-amber-600 font-black text-2xl leading-tight">
                ¥{remaining.toFixed(1)}
              </div>
              <div className="text-amber-500 text-[10px] font-medium">即可免运费</div>
            </div>
          </motion.div>
        )}
        {group.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springBouncy, delay: index * 0.05 + 0.2 }}
            className="flex items-center justify-center mb-3"
          >
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-2 text-center">
              <div className="text-sky-600 font-black text-2xl leading-tight">拼单成功</div>
              <div className="text-sky-500 text-[10px] font-medium">免运费已解锁</div>
            </div>
          </motion.div>
        )}

        <div className="mb-1.5">
          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ...springConfig, delay: index * 0.05 + 0.3, duration: 0.8 }}
              className={`h-full rounded-full ${group.status === 'completed' ? 'bg-sky-400' : 'bg-gradient-to-r from-cyan-400 to-sky-500'}`}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            当前{' '}
            <span className="text-zinc-700 font-bold">¥{group.currentAmount.toFixed(1)}</span>
          </span>
          <span className="text-zinc-400 font-semibold">{pct}%</span>
          <span className="text-zinc-400">
            目标 <span className="text-zinc-700 font-bold">¥{group.targetAmount}</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: index * 0.05 + 0.35 }}
          className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100"
        >
          <div className="flex -space-x-2">
            {group.participants.slice(0, 4).map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ scale: 0, x: -10 }}
                animate={{ scale: 1, x: 0 }}
                transition={{ ...springBouncy, delay: index * 0.05 + 0.4 + i * 0.05 }}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-[9px] font-bold border-2 border-white"
              >
                {p.avatar}
              </motion.div>
            ))}
          </div>
          <span className="text-zinc-400 text-xs flex items-center gap-1">
            <Users size={11} />
            {group.participants.length} 人参与
          </span>
        </motion.div>
      </div>
    </motion.button>
  );
}

export default function SquarePage({ groups, loading, onNavigate, onRefresh }: SquarePageProps) {
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'completed'>('all');
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const activeCount = groups.filter((g) => g.status === 'active').length;
  const completedCount = groups.filter((g) => g.status === 'completed').length;

  // Filter groups based on selected tab
  const filteredGroups = groups.filter((g) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'active') return g.status === 'active';
    if (selectedTab === 'completed') return g.status === 'completed';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col">
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springConfig}
        className="sticky top-0 z-20 bg-[#0a0f1e] px-5 pt-12 pb-4"
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springBouncy, delay: 0.1 }}
                className="text-cyan-400 text-[10px] font-bold tracking-widest uppercase bg-cyan-400/15 px-2 py-0.5 rounded-full"
              >
                Live
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-white/40 text-xs"
              >
                {activeCount} 个拼单进行中
              </motion.span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.15 }}
              className="text-white font-black text-2xl tracking-tight leading-none"
            >
              拼单广场
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-white/30 text-xs mt-1"
            >
              满¥99·平台统一下单
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springBouncy, delay: 0.2 }}
            className="text-right"
          >
            <div className="text-transparent bg-clip-text bg-gradient-to-b from-white/30 to-white/5 font-black text-6xl leading-none select-none">
              {groups.length}
            </div>
            <div className="text-white/20 text-[10px] -mt-1">拼单</div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.3 }}
          className="flex gap-2 mt-3"
        >
          {[
            { key: 'all', label: '全部', count: groups.length },
            { key: 'active', label: '进行中', count: activeCount },
            { key: 'completed', label: '已完成', count: completedCount },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as 'all' | 'active' | 'completed')}
              whileTap={{ scale: 0.95 }}
              transition={springBouncy}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                selectedTab === tab.key
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              {tab.label}({tab.count})
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex-1 px-4 py-4 flex flex-col gap-3 pb-24"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springBouncy, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-rose-500 to-orange-500 rounded-2xl p-4 flex items-center gap-3"
        >
          <Flame size={32} className="text-white/80 flex-shrink-0" />
          <div>
            <div className="text-white font-black text-base leading-tight">今日最热拼单</div>
            <div className="text-white/70 text-xs mt-0.5">
              {groups.find((g) => g.hot)?.title ?? (groups[0]?.title || '暂无拼单')}
            </div>
          </div>
          <div className="ml-auto text-white/60 text-4xl font-black leading-none select-none">
            🔥
          </div>
        </motion.div>

        {loading && filteredGroups.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-cyan-500" />
          </div>
        )}

        {!loading && filteredGroups.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-zinc-400"
          >
            <p className="text-sm mb-4">
              {selectedTab === 'all' ? '暂无拼单，快来发起第一个吧！' : `暂无${selectedTab === 'active' ? '进行中' : '已完成'}的拼单`}
            </p>
          </motion.div>
        )}

        {filteredGroups.map((group, index) => (
          <GroupCard
            key={group.id}
            group={group}
            index={index}
            onClick={() => onNavigate('detail', group.id)}
          />
        ))}
      </motion.div>

      <motion.button
        onClick={() => onNavigate('create')}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springBouncy, delay: 0.5 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-5 w-14 h-14 z-30"
      >
        <img src={cakeImg} alt="发起拼单" className="w-full h-full object-contain" />
      </motion.button>
    </div>
  );
}
