import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, Share2, UserPlus, CheckCircle, Zap, Loader2, Info, X, AlertCircle, Copy, Check, CreditCard, Truck, Package, CheckCheck, Snowflake, XCircle, Plus, MessageSquare, Send } from 'lucide-react';
import { GroupBuy, Participant } from '../types';
import { springConfig, springBouncy, springSnappy } from '../utils/animations';
import { fetchGroupBuyById, fetchCostDetails, exitGroupBuy, addProductsToGroupBuy, updateGroupBuyStatus, fetchMessages, sendMessage, fetchPaymentInfo, fetchPaymentProgress, confirmPayment, fetchPaymentsByGroup, alipayPay, Message, PaymentProgress, PaymentRecord, ApiGroupBuy, ApiCostDetail, CostDetailsResponse } from '../utils/api';

type GroupStatus = 'active' | 'pending_payment' | 'ordered' | 'delivered' | 'completed' | 'cancelled';

interface DetailPageProps {
  group: GroupBuy;
  userId?: number; // 改为可选，未登录时为 undefined
  onBack: () => void;
  onJoin: () => void;
  onRequireLogin?: (action?: () => void) => void; // 要求登录的回调
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

export default function DetailPage({ group, userId, onBack, onJoin, onRequireLogin }: DetailPageProps) {
  const [detailData, setDetailData] = useState<ApiGroupBuy | null>(null);
  const [costDetails, setCostDetails] = useState<CostDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFreightInfo, setShowFreightInfo] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(group.participants);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [groupStatus, setGroupStatus] = useState<GroupStatus>('active');
  const [statusModal, setStatusModal] = useState<{show: boolean; action: string}>({show: false, action: ''});
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [modeSwitchWarning, setModeSwitchWarning] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMessageBoard, setShowMessageBoard] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ payment_remark: string; qr_code_url: string; leader_name: string; leader_avatar: string; total_amount: number } | null>(null);
  const [paymentProgressData, setPaymentProgressData] = useState<PaymentProgress | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [showPaymentProgress, setShowPaymentProgress] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState<number | null>(null);

  // Check if current user is the creator/leader
  const isLeader = userId && group.creator_id === userId;

  // Determine status from detailData or group
  useEffect(() => {
    if (detailData?.status) {
      if (detailData.status === '拼单中' || detailData.status === '进行中') setGroupStatus('active');
      else if (detailData.status === '待付款') setGroupStatus('pending_payment');
      else if (detailData.status === '已下单') setGroupStatus('ordered');
      else if (detailData.status === '已送达') setGroupStatus('delivered');
      else if (detailData.status === '已完成') setGroupStatus('completed');
      else if (detailData.status === '已取消') setGroupStatus('cancelled');
    }
  }, [detailData]);

  // Status action labels
  const statusActions = {
    active: { label: '停止招募', icon: <CheckCircle size={18} />, color: 'bg-amber-500' },
    pending_payment: { label: '取消拼单', icon: <XCircle size={18} />, color: 'bg-rose-500' },
    ordered: { label: '确认送达', icon: <Truck size={18} />, color: 'bg-sky-500' },
    delivered: { label: '完成拼单', icon: <Package size={18} />, color: 'bg-violet-500' },
    completed: null,
    cancelled: null,
  };

  // Load messages when message board opens
  useEffect(() => {
    if (showMessageBoard) {
      loadMessages();
    }
  }, [showMessageBoard, group.id]);

  // Load payment info when QR modal opens
  useEffect(() => {
    if (showQRModal) {
      fetchPaymentInfo(group.id).then(setPaymentInfo).catch(() => setPaymentInfo(null));
    }
  }, [showQRModal, group.id]);

  async function loadMessages() {
    try {
      const msgs = await fetchMessages(group.id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleSendMessage() {
    if (!messageInput.trim()) return;
    if (!userId && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setSendingMessage(true);
    try {
      const newMsg = await sendMessage(group.id, messageInput.trim());
      setMessages(prev => [...prev, newMsg]);
      setMessageInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  }

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
    needs_cold_chain: detailData.needs_cold_chain,
    progress: detailData.progress,
  } : group;

  const pct = Math.min(100, Math.round((displayGroup.currentAmount / displayGroup.targetAmount) * 100));
  const remaining = Math.max(0, displayGroup.targetAmount - displayGroup.currentAmount);
  const displayDeadline = formatDeadline(group.deadline);

  const myCostDetail = costDetails?.costDetails?.find((d: ApiCostDetail) => d.user_id === userId);
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
          onClick={() => setShowMessageBoard(true)}
          whileTap={{ scale: 0.9 }}
          transition={springSnappy}
          className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600"
        >
          <MessageSquare size={16} />
        </motion.button>
        <motion.button
          onClick={() => setShowShareModal(true)}
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
              {participants.length} 人
            </span>
          </div>
          <div className="divide-y divide-zinc-50">
            {participants.map((p, i) => {
              const isCreator = p.id === group.creator_id;
              const isPaid = p.paid ?? false;
              return (
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
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0 ${
                      isCreator ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-teal-400 to-cyan-500'
                    }`}
                  >
                    {p.avatar}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#0c0c0c] font-semibold text-sm truncate">{p.name}</span>
                      {isCreator && (
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">团长</span>
                      )}
                      {!isCreator && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                          {isPaid ? '已付款' : '待付款'}
                        </span>
                      )}
                    </div>
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
                  <div className="flex items-center gap-2">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ ...springBouncy, delay: 0.45 + i * 0.05 }}
                      className="text-orange-500 font-black text-sm"
                    >
                      ¥{p.amount.toFixed(2)}
                    </motion.span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* 费用明细 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.35 }}
          className="bg-white rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-zinc-50 flex items-center justify-between">
            <span className="text-[#0c0c0c] font-bold text-sm">费用明细</span>
            <button
              onClick={() => setShowFreightInfo(true)}
              className="flex items-center gap-1 text-zinc-400 text-xs"
            >
              <Info size={13} />
              运费说明
            </button>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2.5">
            {/* 费用明细头部 */}
            {costDetails && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.38 }}
                className="bg-gradient-to-r from-cyan-50 to-sky-50 rounded-xl px-3 py-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    costDetails.mode === 'sam'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-orange-500 text-white'
                  }`}>
                    {costDetails.mode === 'sam' ? '山姆' : '京东'}
                  </span>
                  <span className="text-xs text-zinc-600 font-medium">
                    {costDetails.mode === 'sam' ? '满¥99免运费' : '未满¥99，含运费'}
                  </span>
                </div>
              </motion.div>
            )}
            {/* 商品费用 */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springConfig, delay: 0.4 }}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-zinc-400">商品费用</span>
              <span className="text-[#0c0c0c] font-bold">¥{myAmount.toFixed(2)}</span>
            </motion.div>
            {/* 各项附加费用 */}
            {costDetails && (
              <>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springConfig, delay: 0.42 }}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-zinc-400 flex items-center gap-1">
                    包装费
                    {costDetails.mode === '京东' && (
                      <span className="flex items-center gap-0.5 text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-200 font-medium">
                        <Snowflake size={9} className="text-sky-500" />
                        含冰鲜
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-500 font-medium">+¥{(costDetails.packaging || 0).toFixed(2)}</span>
                </motion.div>
                {costDetails.mode === 'sam' && costDetails.frozen > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springConfig, delay: 0.44 }}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Snowflake size={12} className="text-cyan-500" /> 生鲜附加费
                    </span>
                    <span className="text-zinc-500 font-medium">+¥{costDetails.frozen.toFixed(2)}</span>
                  </motion.div>
                )}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springConfig, delay: 0.46 }}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-zinc-400">运费</span>
                  <span className={`font-medium ${(costDetails.delivery || 0) === 0 ? 'text-emerald-500' : 'text-zinc-500'}`}>
                    {costDetails.mode === 'sam' && (costDetails.delivery || 0) === 0 ? '已免' : `¥${(costDetails.delivery || 0).toFixed(2)}`}
                    {costDetails.mode === '京东' && `（学生优惠）`}
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springConfig, delay: 0.48 }}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-zinc-400">平台酬劳</span>
                  <span className="text-zinc-500 font-medium">+¥{(costDetails.reward || 0).toFixed(2)}</span>
                </motion.div>
              </>
            )}
            {/* 团长优惠 */}
            {myCostDetail?.leader_discount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springConfig, delay: 0.5 }}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-emerald-500 flex items-center gap-1">
                  <span>🎉</span> 团长优惠
                </span>
                <span className="text-emerald-500 font-bold">-¥{myCostDetail.leader_discount.toFixed(2)}</span>
              </motion.div>
            )}
            {/* 团长优惠例外提示 - 仅对团长显示，且拼单未成功时 */}
            {isLeader && groupStatus !== 'completed' && groupStatus !== 'delivered' && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springConfig, delay: 0.52 }}
                className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2"
              >
                <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-amber-600 text-[11px] leading-relaxed">
                  团长优惠将于<span className="font-bold">拼单成功送达后</span>返还；若拼单失败则不返还
                </p>
              </motion.div>
            )}
            {/* 费用分摊小计 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.5 }}
              className="border-t border-zinc-100 pt-2.5 flex items-center justify-between"
            >
              <span className="text-[#0c0c0c] font-bold text-sm">我应付</span>
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

      {/* 运费说明弹窗 */}
      <AnimatePresence>
        {showFreightInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowFreightInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springBouncy}
              className="bg-white rounded-2xl p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-[#0c0c0c]">运费说明</h3>
                <button onClick={() => setShowFreightInfo(false)} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
              <p className="text-zinc-500 text-xs leading-relaxed">
                山姆极速达：订单实付金额满<span className="font-bold text-[#0c0c0c]">99元</span>免15kg基础运费，超出15kg部分加收1元/kg；不满99元，15kg内收取10元运费，超出15kg部分加收1元/kg。订单金额每增加100元，可减免10元运费。
              </p>
              <p className="text-cyan-600 text-xs font-medium mt-3">
                本平台已为学生提供运费优惠：不满99元仅收5元。
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-100 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex gap-3"
      >
        {/* 团长操作按钮 */}
        {isLeader && groupStatus !== 'completed' && groupStatus !== 'cancelled' && groupStatus === 'active' && (
          <>
            <motion.button
              onClick={() => setStatusModal({show: true, action: groupStatus})}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              className={`flex-1 ${statusActions[groupStatus].color} text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg`}
            >
              {statusActions[groupStatus].icon}
              {statusActions[groupStatus].label}
            </motion.button>
            <motion.button
              onClick={() => setShowProductPicker(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25"
            >
              <Plus size={18} />
              增加商品
            </motion.button>
          </>
        )}

        {/* 团长在待付款/已下单/已送达状态 */}
        {isLeader && groupStatus !== 'active' && groupStatus !== 'completed' && groupStatus !== 'cancelled' && statusActions[groupStatus] && (
          <motion.button
            onClick={() => setStatusModal({show: true, action: groupStatus})}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            className={`flex-1 ${statusActions[groupStatus].color} text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg`}
          >
            {statusActions[groupStatus].icon}
            {statusActions[groupStatus].label}
          </motion.button>
        )}

        {/* 团长查看收款进度 */}
        {isLeader && groupStatus === 'pending_payment' && (
          <motion.button
            onClick={async () => {
              setShowPaymentProgress(true);
              try {
                const [data, records] = await Promise.all([
                  fetchPaymentProgress(group.id),
                  fetchPaymentsByGroup(group.id),
                ]);
                setPaymentProgressData(data);
                setPaymentRecords(records);
              } catch (err) {
                console.error('Failed to load payment progress:', err);
              }
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25"
          >
            <CreditCard size={18} />
            收款进度
          </motion.button>
        )}

        {/* 非团长/已完成/已取消状态 */}
        {!isLeader ? (
          groupStatus === 'active' ? (
            <>
              <motion.button
                onClick={() => {
                  const products = detailData?.products;
                  if (products && products.length > 0) {
                    setShowProductPicker(true);
                  } else {
                    onJoin();
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={springSnappy}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
              >
                <UserPlus size={18} />
                加入拼单
              </motion.button>
              {/* 成员已加入拼单时可退出 */}
              {participants.some(p => p.id === userId) && (
                <motion.button
                  onClick={() => setShowExitConfirm(true)}
                  whileTap={{ scale: 0.96 }}
                  className="px-4 bg-rose-50 text-rose-500 font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center"
                >
                  退出拼单
                </motion.button>
              )}
            </>
          ) : groupStatus === 'pending_payment' ? (
            <motion.button
              onClick={async () => {
                try {
                  const result = await alipayPay({
                    group_buy_id: group.id,
                    user_id: userId,
                    amount: totalFee,
                    device: 'auto',
                  });
                  // Redirect to Alipay payment page
                  window.location.href = result.payment_url;
                } catch (err) {
                  console.error('支付发起失败:', err);
                  // Fallback to QR code modal
                  setShowQRModal(true);
                }
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <CreditCard size={18} />
              付款
            </motion.button>
          ) : groupStatus === 'completed' ? (
            <div className="flex-1 bg-zinc-100 text-zinc-400 font-bold py-3.5 rounded-2xl text-base flex items-center justify-center gap-2">
              <CheckCheck size={18} />
              拼单已完成
            </div>
          ) : groupStatus === 'cancelled' ? (
            <div className="flex-1 bg-zinc-100 text-zinc-400 font-bold py-3.5 rounded-2xl text-base flex items-center justify-center gap-2">
              拼单已取消
            </div>
          ) : (
            <div className="flex-1 bg-zinc-100 text-zinc-400 font-bold py-3.5 rounded-2xl text-base flex items-center justify-center gap-2">
              等待团长统一下单
            </div>
          )
        ) : null}
      </motion.div>


      {/* 分享弹窗 */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springBouncy}
              className="bg-white rounded-2xl p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-[#0c0c0c]">分享拼单</h3>
                <button onClick={() => setShowShareModal(false)} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
              <p className="text-zinc-500 text-sm mb-4">邀请同学一起参与拼单</p>
              <div className="bg-zinc-50 rounded-xl p-4 mb-4">
                <p className="text-[#0c0c0c] font-bold mb-2">{group.title}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <MapPin size={12} />
                  <span>{group.pickupLocation}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-zinc-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[#0c0c0c] font-medium text-sm">拼单链接</p>
                    <p className="text-zinc-400 text-xs mt-0.5">复制链接发送给好友</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://campus-sam.com/invite/${group.id}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-cyan-500 text-white'}`}
                  >
                    {copied ? (
                      <span className="flex items-center gap-1"><Check size={14} />已复制</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy size={14} />复制</span>
                    )}
                  </button>
                </div>
                <div className="bg-zinc-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[#0c0c0c] font-medium text-sm">邀请海报</p>
                    <p className="text-zinc-400 text-xs mt-0.5">生成图片分享到朋友圈</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowShareModal(false);
                      console.log('海报生成功能开发中');
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-cyan-500 text-white"
                  >
                    生成
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 付款码弹窗 */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springBouncy}
              className="bg-white rounded-2xl p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-[#0c0c0c]">平台收款码</h3>
                <button onClick={() => setShowQRModal(false)} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
              <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center mb-4">
                <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#dcdee0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="5" height="5" x="3" y="3" rx="1"/>
                    <rect width="5" height="5" x="16" y="3" rx="1"/>
                    <rect width="5" height="5" x="3" y="16" rx="1"/>
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                    <path d="M21 21v.01"/>
                    <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                    <path d="M3 12h.01"/>
                    <path d="M12 3h.01"/>
                    <path d="M12 16v.01"/>
                    <path d="M16 12h1"/>
                    <path d="M21 12v.01"/>
                    <path d="M12 21v-1"/>
                  </svg>
                </div>
              </div>
              <div className="text-center mb-4">
                <p className="text-[#0c0c0c] font-bold text-sm mb-1">扫码支付</p>
                {paymentInfo?.payment_remark ? (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <p className="text-zinc-400 text-xs">备注：</p>
                    <p className="bg-amber-50 border border-amber-200 text-amber-600 font-bold text-xs px-2 py-1 rounded-lg">
                      {paymentInfo.payment_remark}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentInfo.payment_remark).catch(() => {});
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="w-6 h-6 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 hover:bg-amber-100 transition-colors"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-xs">支付时请备注：拼单#{group.id} + 昵称</p>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                <p><strong>重要提示：</strong></p>
                <p>1. 付款时请务必备注拼单ID和昵称</p>
                <p>2. 付款后联系团长确认收款</p>
                <p>3. 团长确认后状态将更新为"已付款"</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 状态操作确认弹窗 */}
      <AnimatePresence>
        {statusModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setStatusModal({show: false, action: ''})}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springBouncy}
              className="bg-white rounded-2xl p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${statusActions[statusModal.action as GroupStatus]?.color}`}>
                  {statusActions[statusModal.action as GroupStatus]?.icon}
                </div>
                <div>
                  <h3 className="font-black text-[#0c0c0c]">确认{statusActions[statusModal.action as GroupStatus]?.label}</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {statusModal.action === 'active' && '停止后将无法再加入新成员，请确保所有成员已准备就绪'}
                    {statusModal.action === 'pending_payment' && '取消后拼单将结束，金额将原路退回各成员'}
                    {statusModal.action === 'ordered' && '确认商品已送达取货点？'}
                    {statusModal.action === 'delivered' && '完成拼单后，所有成员将收到通知'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusModal({show: false, action: ''})}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 font-bold text-sm"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (statusModal.action === 'pending_payment') {
                      // 取消拼单
                      setActionLoading(true);
                      try {
                        await updateGroupBuyStatus(group.id, '已取消');
                        setGroupStatus('cancelled');
                      } catch (err) {
                        console.error('取消拼单失败:', err);
                      } finally {
                        setActionLoading(false);
                      }
                    } else {
                      // Handle status transition
                      const nextStatus: Record<GroupStatus, GroupStatus> = {
                        active: 'pending_payment',
                        pending_payment: 'cancelled', // 取消拼单
                        ordered: 'delivered',
                        delivered: 'completed',
                        completed: 'completed',
                        cancelled: 'cancelled',
                      };
                      setGroupStatus(nextStatus[statusModal.action as GroupStatus]);
                    }
                    setStatusModal({show: false, action: ''});
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm ${statusActions[statusModal.action as GroupStatus]?.color}`}
                >
                  {actionLoading ? '处理中...' : '确认'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 退出拼单确认弹窗 */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springBouncy}
              className="bg-white rounded-2xl p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={20} className="text-rose-500" />
                </div>
                <div>
                  <h3 className="font-black text-[#0c0c0c]">退出拼单</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">确定要退出此拼单吗？</p>
                </div>
              </div>
              <p className="text-zinc-400 text-xs mb-4">退出后系统将重新计算其他成员的费用。拼单金额不会自动退还，请联系团长处理。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 font-bold text-sm"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setShowExitConfirm(false);
                    setActionLoading(true);
                    try {
                      await exitGroupBuy(group.id);
                      // 刷新数据
                      const updated = await fetchGroupBuyById(group.id);
                      setDetailData(updated);
                    } catch (err) {
                      console.error('退出拼单失败:', err);
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-sm"
                >
                  {actionLoading ? '退出中...' : '确认退出'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 商品选择弹窗 - 拆分选购 */}
      <AnimatePresence>
        {showProductPicker && detailData?.products && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowProductPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springBouncy}
              className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="font-black text-[#0c0c0c]">选择商品</h3>
                <button onClick={() => setShowProductPicker(false)} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-3">
                  {detailData.products.map((product: any, idx: number) => (
                    <div key={product.id} className="bg-zinc-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[#0c0c0c] font-semibold text-sm truncate">{product.name}</div>
                          <div className="text-zinc-400 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                            <span>¥{product.unit_price} × {product.quantity}个</span>
                            {product.allow_split && (
                              <span className="text-cyan-500 text-[10px] bg-cyan-50 px-1.5 py-0.5 rounded-full">可拆卖</span>
                            )}
                            {product.needs_cold_chain && (
                              <span className="flex items-center gap-0.5 text-sky-600 text-[10px] bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-200 font-medium">
                                <Snowflake size={9} className="text-sky-500" />
                                冰鲜
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedProducts(prev => {
                                const current = prev[product.id] || 0;
                                if (current <= 0) return prev;
                                return { ...prev, [product.id]: current - 1 };
                              });
                            }}
                            className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-600 font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-sm">
                            {selectedProducts[product.id] || 0}
                          </span>
                          <button
                            onClick={() => {
                              const maxQty = product.allow_split ? product.quantity : 1;
                              setSelectedProducts(prev => {
                                const current = prev[product.id] || 0;
                                if (current >= maxQty) return prev;
                                return { ...prev, [product.id]: current + 1 };
                              });
                            }}
                            className="w-7 h-7 rounded-full bg-cyan-500 text-white font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {product.allow_split ? (
                        <div className="text-[10px] text-zinc-400">最多可买 {product.quantity} 个</div>
                      ) : (
                        <div className="text-[10px] text-orange-500">该商品不可拆分，需整件购买</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-zinc-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-500 text-sm">已选商品</span>
                  <span className="font-black text-cyan-500">
                    {Object.values(selectedProducts).reduce((a, b) => a + b, 0)} 件
                  </span>
                </div>
                <motion.button
                  onClick={() => {
                    setShowProductPicker(false);
                    onJoin();
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={Object.values(selectedProducts).every(v => v === 0)}
                >
                  <UserPlus size={18} />
                  确认加入
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 留言板弹窗 */}
      <AnimatePresence>
        {showMessageBoard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowMessageBoard(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springBouncy}
              className="bg-white rounded-t-3xl w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-black text-[#0c0c0c]">留言板</h3>
                <button
                  onClick={() => setShowMessageBoard(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
                >
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-sm">
                    暂无留言，快来发起第一个话题吧
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.user_id === userId;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          isMe ? 'bg-gradient-to-br from-cyan-400 to-sky-600 text-white' : 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white'
                        }`}>
                          {msg.user_avatar || msg.user_name?.charAt(0) || 'U'}
                        </div>
                        <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">{msg.user_name}</span>
                            {isMe && <span className="text-[10px] text-cyan-500">(我)</span>}
                          </div>
                          <div className={`rounded-2xl px-3 py-2 text-sm ${
                            isMe ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white rounded-br-sm' : 'bg-zinc-100 text-[#0c0c0c] rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-zinc-300">
                            {new Date(msg.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* 输入框 */}
              <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="说点什么..."
                  maxLength={500}
                  className="flex-1 bg-zinc-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
                <motion.button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendingMessage}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-sky-600 flex items-center justify-center text-white disabled:opacity-40"
                >
                  {sendingMessage ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 收款进度弹窗 */}
      <AnimatePresence>
        {showPaymentProgress && paymentProgressData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowPaymentProgress(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springBouncy}
              className="bg-white rounded-t-3xl w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[#0c0c0c]">收款进度</h3>
                  {paymentProgressData.all_paid && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">全部已收</span>
                  )}
                </div>
                <button
                  onClick={() => setShowPaymentProgress(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
                >
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>

              {/* 进度摘要 */}
              <div className="px-5 py-3 bg-gradient-to-r from-cyan-50 to-sky-50 border-b border-zinc-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-500 text-xs">待收总额</p>
                    <p className="text-[#0c0c0c] font-black text-xl">¥{paymentProgressData.total_amount.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-500 text-xs">已收/待收</p>
                    <p className="text-emerald-500 font-black text-xl">
                      {paymentProgressData.members.filter((m: any) => m.paid).length}/{paymentProgressData.members.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* 成员列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {paymentProgressData.members.map((member: any, i: number) => (
                  <motion.div
                    key={member.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-zinc-50 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                        {member.user_avatar || member.user_name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[#0c0c0c] font-semibold text-sm truncate">{member.user_name}</span>
                          {member.user_id === userId && (
                            <span className="text-[10px] text-cyan-500 bg-cyan-50 px-1.5 py-0.5 rounded-full">(我)</span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          应付 ¥{member.should_pay.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {member.paid ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-500 font-black text-sm">已付款</span>
                            <span className="text-zinc-400 text-[10px]">¥{member.paid_amount.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-rose-500 font-bold text-sm">待付款</span>
                        )}
                      </div>
                    </div>
                    {!member.paid && (
                      <div className="flex gap-2">
                        <motion.button
                          onClick={async () => {
                            try {
                              setConfirmingPayment(member.user_id);
                              const paymentRecord = paymentRecords.find(p => p.user_id === member.user_id);
                              if (paymentRecord) {
                                await confirmPayment(paymentRecord.id, '已确认');
                              }
                              // Refresh data
                              const [data, records] = await Promise.all([
                                fetchPaymentProgress(group.id),
                                fetchPaymentsByGroup(group.id),
                              ]);
                              setPaymentProgressData(data);
                              setPaymentRecords(records);
                            } catch (err) {
                              console.error('确认付款失败:', err);
                            } finally {
                              setConfirmingPayment(null);
                            }
                          }}
                          disabled={confirmingPayment !== null}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm disabled:opacity-50"
                        >
                          {confirmingPayment === member.user_id ? '确认中...' : '确认收款'}
                        </motion.button>
                        <motion.button
                          onClick={async () => {
                            try {
                              setConfirmingPayment(member.user_id);
                              const paymentRecord = paymentRecords.find(p => p.user_id === member.user_id);
                              if (paymentRecord) {
                                await confirmPayment(paymentRecord.id, '已拒绝');
                              }
                              const [data, records] = await Promise.all([
                                fetchPaymentProgress(group.id),
                                fetchPaymentsByGroup(group.id),
                              ]);
                              setPaymentProgressData(data);
                              setPaymentRecords(records);
                            } catch (err) {
                              console.error('拒绝付款失败:', err);
                            } finally {
                              setConfirmingPayment(null);
                            }
                          }}
                          disabled={confirmingPayment !== null}
                          whileTap={{ scale: 0.95 }}
                          className="py-2 px-3 rounded-xl bg-rose-100 text-rose-500 font-bold text-sm disabled:opacity-50"
                        >
                          拒绝
                        </motion.button>
                      </div>
                    )}
                    {member.paid && member.paid_at && (
                      <p className="text-[10px] text-zinc-400 text-right">
                        付款时间：{new Date(member.paid_at).toLocaleString('zh-CN')}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
