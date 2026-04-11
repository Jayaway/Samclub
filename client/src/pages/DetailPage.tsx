import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, Share2, UserPlus, CheckCircle, Zap, Loader2 } from 'lucide-react';
import { GroupBuy } from '../types';
import { springConfig, springBouncy, springSnappy } from '../utils/animations';
import { fetchGroupBuyById, fetchCostDetails } from '../utils/api';

interface DetailPageProps {
  group: GroupBuy;
  userId: number;
  onBack: () => void;
  onJoin: () => void;
}

function formatDeadline(deadline: string): string {
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

export default function DetailPage({ group, userId, onBack, onJoin }: DetailPageProps) {
  const [detailData, setDetailData] = useState<any>(null);
  const [costDetails, setCostDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        const [detail, costs] = await Promise.all([
          fetchGroupBuyById(group.id),
          fetchCostDetails(group.id),
        ]);
        setDetailData(detail);
        setCostDetails(costs);
      } catch (err) {
        console.error('Failed to load detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [group.id]);

  const displayGroup = detailData ? {
    ...group,
    currentAmount: detailData.total_amount || 0,
    has_frozen: detailData.has_frozen,
    progress: detailData.progress,
  } : group;

  const pct = Math.min(100, Math.round((displayGroup.currentAmount / displayGroup.targetAmount) * 100));
  const remaining = Math.max(0, displayGroup.targetAmount - displayGroup.currentAmount);
  const displayDeadline = formatDeadline(group.deadline);

  const myCostDetail = costDetails?.costDetails?.find((d: any) => d.user_id === userId);
  const myAmount = myCostDetail?.base_amount || displayGroup.participants[0]?.amount || 0;
  const splitFee = myCostDetail?.share_fee || 0;
  const totalFee = myCostDetail?.final_amount || myAmount + splitFee;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cyan-500" />
      </div>
    );
  }

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
        <h1 className="text-[#0c0c0c] font-black text-lg flex-1 truncate">拼单详情</h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={springSnappy}
          className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600"
        >
          <Share2 size={16} />
        </motion.button>
      </motion.div>

      <div className="flex-1 px-4 pt-4 pb-32 flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...springBouncy, delay: 0.1 }}
          className="bg-[#0a0f1e] rounded-2xl p-5 relative overflow-hidden"
        >
          <div className="absolute -right-4 -bottom-4 text-[100px] font-black text-white/[0.04] leading-none select-none pointer-events-none">
            {pct}%
          </div>

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springConfig, delay: 0.15 }}
              className="flex items-center gap-2 mb-3"
            >
              {group.status === 'active' ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.2 }}
                  className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                >
                  <Zap size={11} />
                  拼单中
                </motion.span>
              ) : (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.2 }}
                  className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                >
                  <CheckCircle size={11} />
                  已成团
                </motion.span>
              )}
              {group.status === 'active' && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-amber-400 text-xs font-medium flex items-center gap-1"
                >
                  <Clock size={11} />
                  剩余 {displayDeadline}
                </motion.span>
              )}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.2 }}
              className="text-white font-black text-xl leading-tight mb-3"
            >
              {group.title}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.25 }}
              className="flex items-center gap-2 mb-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springBouncy, delay: 0.3 }}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center text-white text-xs font-black"
              >
                {group.creatorAvatar}
              </motion.div>
              <div>
                <div className="text-white/80 text-sm font-medium">{group.creator}</div>
                <div className="text-white/30 text-xs">发起人</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex gap-3 mb-4"
            >
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <MapPin size={11} />
                {group.pickupLocation}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.4 }}
              className="bg-white/5 rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs">拼单进度</span>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.5 }}
                  className="text-cyan-400 font-black text-sm"
                >
                  {pct}%
                </motion.span>
              </div>
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ ...springConfig, delay: 0.45, duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-black text-xl">¥{displayGroup.currentAmount.toFixed(2)}</span>
                  <span className="text-white/30 text-sm"> / ¥{displayGroup.targetAmount}</span>
                </div>
                {remaining > 0 ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ ...springBouncy, delay: 0.55 }}
                    className="text-amber-400 text-xs font-bold bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg"
                  >
                    还差 ¥{remaining.toFixed(1)}
                  </motion.span>
                ) : (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ ...springBouncy, delay: 0.55 }}
                    className="text-emerald-400 text-xs font-bold bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-lg"
                  >
                    免运费已解锁
                  </motion.span>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* 参与者 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.2 }}
          className="bg-white rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-zinc-50 flex items-center justify-between">
            <span className="text-[#0c0c0c] font-bold text-sm">参与者</span>
            <span className="text-zinc-400 text-xs bg-zinc-100 px-2 py-0.5 rounded-full">
              {group.participants.length} 人
            </span>
          </div>
          <div className="divide-y divide-zinc-50">
            {group.participants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springConfig, delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.35 + i * 0.05 }}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                >
                  {p.avatar}
                </motion.div>
                <div className="flex-1">
                  <div className="text-[#0c0c0c] font-semibold text-sm">{p.name}</div>
                  <div className="text-zinc-400 text-xs mt-0.5">
                    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden w-24">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (p.amount / displayGroup.targetAmount) * 100)}%` }}
                        transition={{ ...springConfig, delay: 0.4 + i * 0.05, duration: 0.6 }}
                        className="h-full bg-gradient-to-r from-cyan-400 to-sky-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.45 + i * 0.05 }}
                  className="text-orange-500 font-black text-sm"
                >
                  ¥{p.amount.toFixed(2)}
                </motion.span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 费用明细 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.35 }}
          className="bg-white rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-zinc-50">
            <span className="text-[#0c0c0c] font-bold text-sm">费用明细</span>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2.5">
            {[
              { label: '商品费用', value: `¥${myAmount.toFixed(2)}`, color: 'text-[#0c0c0c]' },
              { label: '费用分摊', value: `¥${splitFee.toFixed(2)}`, color: 'text-zinc-500' },
            ].map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springConfig, delay: 0.4 + i * 0.05 }}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-zinc-400">{row.label}</span>
                <span className={`font-bold ${row.color}`}>{row.value}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.5 }}
              className="border-t border-zinc-100 pt-2.5 flex items-center justify-between"
            >
              <span className="text-[#0c0c0c] font-bold text-sm">总计</span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springBouncy, delay: 0.55 }}
                className="text-orange-500 font-black text-xl"
              >
                ¥{totalFee.toFixed(2)}
              </motion.span>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-100 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex gap-3"
      >
        <motion.button
          onClick={onJoin}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={springSnappy}
          className="flex-1 bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
        >
          <UserPlus size={18} />
          加入拼单
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={springSnappy}
          className="w-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-500"
        >
          <Share2 size={18} />
        </motion.button>
      </motion.div>
    </div>
  );
}
