import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, ShoppingBag, Clock, HelpCircle, Info, ChevronRight, X, MessageCircle, Users, FileText, Phone, Mail } from 'lucide-react';
import { springConfig, springBouncy, springSnappy, modalVariants, overlayVariants } from '../utils/animations';
import { User as UserType, fetchGroupBuys } from '../utils/api';

interface ProfilePageProps {
  user: UserType;
  onLogout: () => void;
  onNavigate: (page: 'square' | 'my') => void;
}

type ModalType = 'history' | 'help' | 'about' | null;

interface MyGroupBuy {
  id: number;
  title: string;
  status: string;
  member_count: number;
  total_cost: number;
}

export default function ProfilePage({ user, onLogout, onNavigate }: ProfilePageProps) {
  const [myGroups, setMyGroups] = useState<MyGroupBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedGroups, setJoinedGroups] = useState<MyGroupBuy[]>([]);
  const [showModal, setShowModal] = useState<ModalType>(null);

  useEffect(() => {
    async function loadMyGroups() {
      try {
        const groups = await fetchGroupBuys();
        // Filter groups created by this user
        const myCreated = groups.filter(g => g.creator_id === user.id);
        setMyGroups(myCreated.map(g => ({
          id: g.id,
          title: g.title,
          status: g.status,
          member_count: g.member_count || 0,
          total_cost: g.total_amount || 0,
        })));
        // Filter groups this user joined (but didn't create)
        const myJoined = groups.filter(g => g.creator_id !== user.id && g.members?.some((m: any) => m.user_id === user.id));
        setJoinedGroups(myJoined.map(g => ({
          id: g.id,
          title: g.title,
          status: g.status,
          member_count: g.member_count || 0,
          total_cost: g.total_amount || 0,
        })));
      } catch (err) {
        console.error('Failed to load groups:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMyGroups();
  }, [user.id]);

  const menuItems = [
    { icon: ShoppingBag, label: '我的拼单', onClick: () => onNavigate('my') },
    { icon: Clock, label: '历史参与', onClick: () => setShowModal('history') },
    { icon: HelpCircle, label: '帮助与反馈', onClick: () => setShowModal('help') },
    { icon: Info, label: '关于我们', onClick: () => setShowModal('about') },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springConfig}
        className="bg-gradient-to-br from-[#0a0f1e] to-[#1a2a4a] px-5 pt-12 pb-8"
      >
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springBouncy, delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center text-white text-2xl font-black overflow-hidden"
          >
            {user.avatar ? (
              <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
            ) : (
              user.nickname?.charAt(0) || 'U'
            )}
          </motion.div>
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig, delay: 0.15 }}
              className="text-white font-black text-xl"
            >
              {user.nickname}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/50 text-sm mt-1"
            >
              学号: {user.student_id}
            </motion.p>
            {user.dorm_building && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-white/40 text-xs mt-0.5"
              >
                📍 {user.dorm_building}
              </motion.p>
            )}
            {user.phone && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/40 text-xs mt-0.5"
              >
                📱 {user.phone}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>

      {/* My Groups */}
      <div className="px-4 -mt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.2 }}
          className="bg-white rounded-2xl shadow-md overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-[#0c0c0c] font-bold">我发起的拼单</span>
            <span className="text-zinc-400 text-xs">{myGroups.length} 个</span>
          </div>

          {loading ? (
            <div className="p-4 text-center text-zinc-400 text-sm">加载中...</div>
          ) : myGroups.length === 0 ? (
            <div className="p-4 text-center text-zinc-400 text-sm">
              暂无发起的拼单
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {myGroups.map((group, i) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springConfig, delay: 0.3 + i * 0.05 }}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-[#0c0c0c] font-semibold text-sm">{group.title}</div>
                    <div className="text-zinc-400 text-xs mt-0.5">
                      {group.member_count}人参与 · ¥{group.total_cost.toFixed(2)}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    group.status === '进行中'
                      ? 'bg-emerald-100 text-emerald-600'
                      : group.status === '已完成'
                      ? 'bg-sky-100 text-sky-600'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {group.status}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.35 }}
          className="bg-white rounded-2xl shadow-md overflow-hidden"
        >
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                onClick={item.onClick}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springConfig, delay: 0.4 + i * 0.05 }}
                className="w-full px-4 py-3.5 flex items-center justify-between border-b border-zinc-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <Icon size={16} className="text-cyan-500" />
                  </div>
                  <span className="text-[#0c0c0c] font-medium text-sm">{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-zinc-300" />
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-4 mb-8">
        <motion.button
          onClick={onLogout}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.6 }}
          className="w-full bg-white rounded-2xl shadow-md px-4 py-3.5 flex items-center justify-center gap-2 text-red-500 font-medium"
        >
          <LogOut size={16} />
          退出登录
        </motion.button>
      </div>

      {/* Version */}
      <div className="text-center text-zinc-300 text-xs pb-8">
        校园山姆拼单 v1.0
      </div>

      {/* 历史参与 Modal */}
      <AnimatePresence>
        {showModal === 'history' && (
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
            onClick={() => setShowModal(null)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white w-full rounded-t-3xl p-5 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0c0c0c] font-black text-lg">历史参与</h3>
                <button onClick={() => setShowModal(null)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>
              {joinedGroups.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  <Users size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无历史参与的拼单</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {joinedGroups.map((group, i) => (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springConfig, delay: i * 0.05 }}
                      className="bg-zinc-50 rounded-xl px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[#0c0c0c] font-semibold text-sm">{group.title}</div>
                        <div className="text-zinc-400 text-xs mt-0.5">
                          {group.member_count}人参与 · ¥{group.total_cost.toFixed(2)}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        group.status === '进行中'
                          ? 'bg-emerald-100 text-emerald-600'
                          : group.status === '已完成'
                          ? 'bg-sky-100 text-sky-600'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {group.status}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 帮助与反馈 Modal */}
      <AnimatePresence>
        {showModal === 'help' && (
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
            onClick={() => setShowModal(null)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white w-full rounded-t-3xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0c0c0c] font-black text-lg">帮助与反馈</h3>
                <button onClick={() => setShowModal(null)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-zinc-50 rounded-xl p-4">
                  <h4 className="font-bold text-sm text-[#0c0c0c] mb-2 flex items-center gap-2">
                    <HelpCircle size={16} className="text-cyan-500" />
                    常见问题
                  </h4>
                  <div className="space-y-2 text-xs text-zinc-500">
                    <p><strong>Q: 如何创建拼单？</strong></p>
                    <p>A: 在拼单广场点击右下角"+"按钮，填写取货地点和截止时间，添加商品后提交即可。</p>
                    <p className="mt-2"><strong>Q: 运费如何计算？</strong></p>
                    <p>A: 订单满99元免运费，不满99元收5元学生优惠运费。</p>
                    <p className="mt-2"><strong>Q: 如何付款？</strong></p>
                    <p>A: 拼单成功后，团长会展示收款码，付款时请备注"拼单ID+昵称"。</p>
                  </div>
                </div>
                <div className="bg-zinc-50 rounded-xl p-4">
                  <h4 className="font-bold text-sm text-[#0c0c0c] mb-2 flex items-center gap-2">
                    <MessageCircle size={16} className="text-cyan-500" />
                    意见反馈
                  </h4>
                  <p className="text-xs text-zinc-500 mb-3">遇到问题或有任何建议？欢迎联系我们</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => window.open('https://work.weixin.qq.com/kfid/kfid1', '_blank')}
                      className="flex-1 bg-cyan-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={16} />
                      在线客服
                    </button>
                    <button
                      onClick={() => window.location.href = 'mailto:support@campus-sam.com?subject=校园山姆拼单反馈'}
                      className="flex-1 bg-zinc-100 text-zinc-600 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Mail size={16} />
                      发邮件
                    </button>
                  </div>
                </div>
                <div className="text-center text-zinc-400 text-xs">
                  客服时间：工作日 9:00-18:00
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 关于我们 Modal */}
      <AnimatePresence>
        {showModal === 'about' && (
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowModal(null)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center">
                  <ShoppingBag size={36} className="text-white" />
                </div>
                <h3 className="text-[#0c0c0c] font-black text-xl mb-1">校园山姆拼单</h3>
                <p className="text-zinc-400 text-sm">版本 1.0.0</p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                  <FileText size={18} className="text-cyan-500" />
                  <div>
                    <p className="font-medium text-[#0c0c0c]">平台简介</p>
                    <p className="text-zinc-400 text-xs mt-0.5">专为校园学生打造的拼单平台，汇聚山姆好物，共享免运费优惠。</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                  <Users size={18} className="text-cyan-500" />
                  <div>
                    <p className="font-medium text-[#0c0c0c]">运营方</p>
                    <p className="text-zinc-400 text-xs mt-0.5">校园拼单运营团队</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                  <Phone size={18} className="text-cyan-500" />
                  <div>
                    <p className="font-medium text-[#0c0c0c]">联系我们</p>
                    <p className="text-zinc-400 text-xs mt-0.5">support@campus-sam.com</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold py-3 rounded-xl"
              >
                知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
