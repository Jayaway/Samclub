import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, Plus, X, ChevronRight, Sparkles, Loader2, AlertTriangle, Snowflake } from 'lucide-react';
import { springConfig, springBouncy, springSnappy, modalVariants, overlayVariants } from '../utils/animations';
import { createGroupBuy, checkDuplicateGroupBuy } from '../utils/api';
import WheelPicker from '../components/WheelPicker';

interface CreatePageProps {
  userId: number;
  onBack: () => void;
  onCreated: () => void;
}

interface AddedProduct {
  id: string;
  product_type: 'fixed' | 'custom';
  name: string;
  original_price: number;
  quantity: number; // 整份数量
  remaining_quantity: number;
  allow_split: boolean;
  split_unit: string; // 拆分单位（片/个）
  split_quantity_per_whole: number; // 每整份含拆分单位数
  split_price_per_unit: number; // 拆分单价（分）
  self_retain_quantity: number; // 发起人自留拆分单位数（不计入可售库存）
  needs_cold_chain: boolean;
  unit_price: number;
}

const sampleProducts = [
  { id: '1', name: '山姆有机草莓 500g', original_price: 28.9, quantity: 5, needs_cold_chain: false, allow_split: false, split_unit: '颗', split_quantity_per_whole: 1, split_price_per_unit: 2890, self_retain_quantity: 0, product_type: 'fixed' as const },
  { id: '2', name: '山姆瑞士卷蛋糕', original_price: 39.9, quantity: 4, needs_cold_chain: false, allow_split: true, split_unit: '片', split_quantity_per_whole: 6, split_price_per_unit: 665, self_retain_quantity: 0, product_type: 'fixed' as const },
  { id: '3', name: '山姆鲜牛奶 1L', original_price: 14.9, quantity: 6, needs_cold_chain: true, allow_split: false, split_unit: '盒', split_quantity_per_whole: 1, split_price_per_unit: 1490, self_retain_quantity: 0, product_type: 'fixed' as const },
  { id: '4', name: '山姆坚果混合装 750g', original_price: 59.9, quantity: 5, needs_cold_chain: false, allow_split: true, split_unit: '包', split_quantity_per_whole: 1, split_price_per_unit: 5990, self_retain_quantity: 0, product_type: 'fixed' as const },
  { id: '5', name: '山姆藤椒味薯片 270g', original_price: 18.9, quantity: 8, needs_cold_chain: false, allow_split: true, split_unit: '袋', split_quantity_per_whole: 1, split_price_per_unit: 1890, self_retain_quantity: 0, product_type: 'fixed' as const },
];

export default function CreatePage({ userId, onBack, onCreated }: CreatePageProps) {
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  });
  const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'fixed' | 'custom'>('fixed');
  const [customForm, setCustomForm] = useState({ name: '', original_price: '', quantity: '1', needs_cold_chain: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; groups: { id: number; title: string; deadline: string; currentAmount?: number; targetAmount?: number }[] } | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Format deadline for display
  const formatDeadlineDisplay = (d: Date) => {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const total = addedProducts.reduce((s, p) => s + p.original_price, 0);

  const removeProduct = (id: string) => {
    setAddedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const updateSelfRetain = (id: string, delta: number) => {
    setAddedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const maxRetain = p.allow_split ? p.quantity * p.split_quantity_per_whole : 0;
        const newVal = Math.max(0, Math.min(maxRetain, p.self_retain_quantity + delta));
        return { ...p, self_retain_quantity: newVal };
      })
    );
  };

  const addProduct = (p: typeof sampleProducts[0]) => {
    if (!addedProducts.find((ap) => ap.id === p.id)) {
      const unit_price = parseFloat((p.original_price / p.quantity).toFixed(2));
      setAddedProducts((prev) => [...prev, {
        id: p.id,
        product_type: 'fixed',
        name: p.name,
        original_price: p.original_price,
        quantity: p.quantity,
        remaining_quantity: p.quantity,
        allow_split: p.allow_split,
        split_unit: p.split_unit,
        split_quantity_per_whole: p.split_quantity_per_whole,
        split_price_per_unit: p.split_price_per_unit,
        self_retain_quantity: p.self_retain_quantity,
        needs_cold_chain: p.needs_cold_chain,
        unit_price,
      }]);
    }
    setShowPicker(false);
  };

  const addCustomProduct = () => {
    if (!customForm.name.trim()) return;
    const price = parseFloat(customForm.original_price);
    if (!price || price <= 0) return;
    const qty = parseInt(customForm.quantity) || 1;
    const id = `custom_${Date.now()}`;
    const unit_price = parseFloat((price / qty).toFixed(2));
    setAddedProducts((prev) => [...prev, {
      id,
      product_type: 'custom',
      name: customForm.name.trim(),
      original_price: price,
      quantity: qty,
      remaining_quantity: qty,
      allow_split: false,
      split_unit: '',
      split_quantity_per_whole: 0,
      split_price_per_unit: 0,
      self_retain_quantity: 0,
      needs_cold_chain: customForm.needs_cold_chain,
      unit_price,
    }]);
    setCustomForm({ name: '', original_price: '', quantity: '1', needs_cold_chain: false });
    setPickerTab('fixed');
    setShowPicker(false);
  };

  const doSubmit = async () => {
    setError('');
    setLoading(true);
    setPendingSubmit(false);

    try {
      const title = addedProducts.length === 1
        ? addedProducts[0].name
        : `${addedProducts[0].name}等`;

      await createGroupBuy({
        creator_id: userId,
        title,
        deadline: deadline.toISOString(),
        pickup_location: location.trim(),
        products: addedProducts.map(p => ({
          product_type: p.product_type,
          name: p.name,
          original_price: p.original_price,
          quantity: p.quantity,
          remaining_quantity: p.quantity,
          allow_split: p.allow_split,
          split_unit: p.split_unit,
          split_quantity_per_whole: p.split_quantity_per_whole,
          split_price_per_unit: p.split_price_per_unit,
          self_retain_quantity: p.self_retain_quantity,
          needs_cold_chain: p.needs_cold_chain,
          unit_price: p.unit_price,
        })),
      });

      onCreated();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!location.trim()) {
      setError('请填写取货地点');
      return;
    }
    if (!deadline) {
      setError('请选择截止时间');
      return;
    }
    if (addedProducts.length === 0) {
      setError('请添加至少一个商品');
      return;
    }

    // 拆分单价校验：split_price_per_unit ≤ original_price / split_quantity_per_whole
    for (const p of addedProducts) {
      if (p.allow_split) {
        const maxUnitPrice = (p.original_price / p.split_quantity_per_whole) * 100; // 转为分
        if (p.split_price_per_unit > maxUnitPrice) {
          setError(`${p.name}的拆分单价不能高于整份均摊单价¥${(maxUnitPrice / 100).toFixed(2)}`);
          return;
        }
      }
    }

    // 重复检查：取所有商品名前4字作为关键词，聚合去重
    const allKeywords = [...new Set(addedProducts.map(p => p.name.slice(0, 4)))];
    try {
      const allSimilar: { id: number; title: string; deadline: string; currentAmount?: number; targetAmount?: number }[] = [];
      for (const keyword of allKeywords) {
        const { similar } = await checkDuplicateGroupBuy(keyword, deadline.toISOString());
        if (similar) {
          for (const s of similar) {
            if (!allSimilar.find(x => x.id === s.id)) {
              allSimilar.push(s);
            }
          }
        }
      }
      if (allSimilar.length > 0) {
        const first = allSimilar[0];
        const more = allSimilar.length > 1 ? `等${allSimilar.length}个` : '';
        const deadlineStr = first.deadline ? `截止${new Date(first.deadline).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}` : '';
        setDuplicateWarning({
          message: `广场已存在同类拼单${more}："${first.title}"${deadlineStr}，是否仍要发起？`,
          groups: allSimilar,
        });
        setPendingSubmit(true);
        return;
      }
    } catch (_) {
      // 检查失败不阻止创建
    }

    await doSubmit();
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
        <div>
          <h1 className="text-[#0c0c0c] font-black text-lg leading-none">发起拼单</h1>
          <p className="text-zinc-400 text-xs mt-0.5">邀请同学一起拼团</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {[1, 2, 3].map((n, i) => (
            <motion.div
              key={n}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: i * 0.1 }}
              className={`w-2 h-2 rounded-full transition-all ${n === 1 ? 'w-5 bg-cyan-500' : 'bg-zinc-200'}`}
            />
          ))}
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl"
        >
          {error}
        </motion.div>
      )}

      <div className="flex-1 px-4 pt-4 pb-24 flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...springBouncy, delay: 0.1 }}
          className="bg-gradient-to-br from-[#0a0f1e] to-[#0e2040] rounded-2xl p-5 relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 text-[80px] select-none pointer-events-none opacity-10 font-black">
            🛒
          </div>
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...springBouncy, delay: 0.2 }}
            >
              <Sparkles size={14} className="text-cyan-400" />
            </motion.div>
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="text-cyan-400 text-xs font-bold tracking-widest uppercase"
            >
              New Group
            </motion.span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springConfig, delay: 0.3 }}
            className="text-white font-black text-2xl leading-tight"
          >
            凑满 <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">¥99</span>
            <br />解锁免运费
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-white/40 text-xs mt-1"
          >
            平台统一下单 · 安全可靠
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.15 }}
          className="bg-white rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-zinc-50 flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: 0.2 }}
              className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs font-black"
            >
              1
            </motion.div>
            <span className="text-[#0c0c0c] font-bold text-sm">取货信息</span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springConfig, delay: 0.25 }}
            >
              <label className="text-zinc-400 text-xs font-medium flex items-center gap-1 mb-1.5">
                <MapPin size={11} />
                取货地点
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例：3号宿舍楼门口"
                className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] placeholder-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 focus:bg-white transition-all"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springConfig, delay: 0.3 }}
            >
              <label className="text-zinc-400 text-xs font-medium flex items-center gap-1 mb-1.5">
                <Clock size={11} />
                截止时间
              </label>
              <button
                type="button"
                onClick={() => setShowTimePicker(true)}
                className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 focus:bg-white transition-all flex items-center justify-between"
              >
                <span>{formatDeadlineDisplay(deadline)}</span>
                <span className="text-cyan-500 text-xs font-medium">点击选择</span>
              </button>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.2 }}
          className="bg-white rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-zinc-50 flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: 0.25 }}
              className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-black"
            >
              2
            </motion.div>
            <span className="text-[#0c0c0c] font-bold text-sm">拼单商品</span>
            <span className="ml-auto text-zinc-400 text-xs">
              合计{' '}
              <motion.span
                key={total}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={springSnappy}
                className="font-black text-orange-500"
              >
                ¥{total.toFixed(1)}
              </motion.span>
            </span>
          </div>

          <div className="p-3 flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {addedProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ ...springConfig, delay: i * 0.05 }}
                  className="flex items-center gap-3 bg-zinc-50 rounded-xl px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[#0c0c0c] font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-zinc-400 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>¥{p.original_price} × {p.quantity}个</span>
                      {p.allow_split && (
                        <span className="text-cyan-500 text-[10px] bg-cyan-50 px-1.5 py-0.5 rounded-full">可拆{p.split_quantity_per_whole}{p.split_unit}/份</span>
                      )}
                      {p.needs_cold_chain && (
                        <span className="flex items-center gap-0.5 text-sky-600 text-[10px] bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-200 font-medium">
                          <Snowflake size={9} className="text-sky-500" />
                          冰鲜
                        </span>
                      )}
                    </div>
                    {/* 自留拆分单位编辑 - 仅允许拆分的商品显示 */}
                    {p.allow_split && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-amber-600 text-[10px]">自留:</span>
                        <button
                          onClick={() => updateSelfRetain(p.id, -1)}
                          disabled={p.self_retain_quantity === 0}
                          className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                        >-</button>
                        <span className="text-amber-600 text-xs font-bold w-6 text-center">
                          {p.self_retain_quantity}{p.split_unit}
                        </span>
                        <button
                          onClick={() => updateSelfRetain(p.id, 1)}
                          disabled={p.self_retain_quantity >= p.quantity * p.split_quantity_per_whole}
                          className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                        >+</button>
                        <span className="text-zinc-400 text-[10px]">
                          (共{p.quantity * p.split_quantity_per_whole}{p.split_unit}，自留后可售{p.quantity * p.split_quantity_per_whole - p.self_retain_quantity}{p.split_unit})
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-orange-500 font-black text-sm">
                    ¥{p.original_price.toFixed(1)}
                  </span>
                  <motion.button
                    onClick={() => removeProduct(p.id)}
                    whileTap={{ scale: 0.8 }}
                    transition={springSnappy}
                    className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500"
                  >
                    <X size={12} />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>

            <motion.button
              onClick={() => setShowPicker(true)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={springSnappy}
              className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-zinc-200 text-zinc-400 text-sm font-medium rounded-xl py-3 hover:border-cyan-300 hover:text-cyan-500 transition-all"
            >
              <Plus size={16} />
              添加商品
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.25 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-700 font-medium">我的份额</span>
            <motion.span
              key={total}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={springSnappy}
              className="text-amber-600 font-black text-lg"
            >
              ¥{total.toFixed(2)}
            </motion.span>
          </div>
          {total < 99 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-amber-600 text-xs mt-1 flex items-center gap-1"
            >
              <span>还需要其他同学凑</span>
              <span className="font-bold">¥{(99 - total).toFixed(1)}</span>
              <span>即可免运费</span>
            </motion.div>
          )}
        </motion.div>

        {/* 提交按钮 - 放在内容底部而非fixed */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springConfig, delay: 0.3 }}
          className="mt-4"
        >
          <motion.button
            onClick={handleSubmit}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.96 }}
            transition={springSnappy}
            className="w-full bg-gradient-to-r from-cyan-500 to-sky-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>创建中...</span>
              </>
            ) : (
              <>
                <span>提交创建</span>
                <ChevronRight size={18} />
              </>
            )}
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showPicker && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowPicker(false)}
            />
            {/* Modal Content */}
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl p-5"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0c0c0c] font-black text-lg">添加商品</h3>
                <motion.button
                  onClick={() => setShowPicker(false)}
                  whileTap={{ scale: 0.9 }}
                  transition={springSnappy}
                  className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* 商品类型切换 */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setPickerTab('fixed')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    pickerTab === 'fixed'
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  固定商品
                </button>
                <button
                  onClick={() => setPickerTab('custom')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    pickerTab === 'custom'
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  自定义商品
                </button>
              </div>

              {pickerTab === 'fixed' ? (
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                  {sampleProducts.map((p, i) => {
                    const added = !!addedProducts.find((ap) => ap.id === p.id);
                    return (
                      <motion.button
                        key={p.id}
                        onClick={() => !added && addProduct(p)}
                        disabled={added}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springConfig, delay: i * 0.05 }}
                        whileHover={!added ? { scale: 1.02, backgroundColor: 'rgba(6, 182, 212, 0.1)' } : {}}
                        whileTap={!added ? { scale: 0.98 } : {}}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-left ${
                          added ? 'bg-zinc-50 opacity-50' : 'bg-zinc-50'
                        }`}
                      >
                        <div>
                          <span className="text-[#0c0c0c] font-medium text-sm block">{p.name}</span>
                          <span className="text-zinc-400 text-xs flex items-center gap-1 flex-wrap">
                            <span>¥{p.original_price} × {p.quantity}个</span>
                            {p.allow_split && (
                              <span className="text-cyan-500">可拆{p.split_quantity_per_whole}{p.split_unit}/份</span>
                            )}
                            {p.needs_cold_chain && (
                              <span className="flex items-center gap-0.5 text-sky-600">
                                <Snowflake size={9} className="text-sky-500" />
                                冰鲜
                              </span>
                            )}
                          </span>
                        </div>
                        <span className={`font-black text-sm ${added ? 'text-zinc-400' : 'text-orange-500'}`}>
                          {added ? '已添加' : `¥${p.original_price}`}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
                  <div>
                    <label className="text-zinc-400 text-xs font-medium mb-1 block">商品名</label>
                    <input
                      type="text"
                      value={customForm.name}
                      onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="如：山姆智利车厘子 500g"
                      className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] placeholder-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-zinc-400 text-xs font-medium mb-1 block">总价（元）</label>
                      <input
                        type="number"
                        step="0.01"
                        value={customForm.original_price}
                        onChange={(e) => setCustomForm((f) => ({ ...f, original_price: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] placeholder-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-zinc-400 text-xs font-medium mb-1 block">份数</label>
                      <input
                        type="number"
                        min="1"
                        value={customForm.quantity}
                        onChange={(e) => setCustomForm((f) => ({ ...f, quantity: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400 text-center"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCustomForm((f) => ({ ...f, needs_cold_chain: !f.needs_cold_chain }))}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        customForm.needs_cold_chain ? 'bg-sky-500 text-white' : 'bg-zinc-200 text-zinc-400'
                      }`}
                    >
                      {customForm.needs_cold_chain && <Snowflake size={12} />}
                    </button>
                    <span className="text-zinc-500 text-xs">需冰鲜配送</span>
                  </div>
                  <motion.button
                    onClick={addCustomProduct}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-md shadow-amber-500/30 disabled:opacity-40"
                    disabled={!customForm.name.trim() || !customForm.original_price}
                  >
                    添加自定义商品
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 重复拼单确认弹窗 */}
      <AnimatePresence>
        {duplicateWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springBouncy}
              className="bg-white rounded-2xl p-5 w-full max-w-sm"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-black text-[#0c0c0c] mb-1">发现同类拼单</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{duplicateWarning.message}</p>
                </div>
              </div>
              {duplicateWarning.groups.length > 1 && (
                <div className="mb-4 space-y-2">
                  {duplicateWarning.groups.slice(0, 3).map(g => (
                    <div key={g.id} className="bg-zinc-50 rounded-lg px-3 py-2 text-xs">
                      <div className="text-[#0c0c0c] font-medium truncate">{g.title}</div>
                      {g.deadline && (
                        <div className="text-zinc-400 mt-0.5">截止 {new Date(g.deadline).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      )}
                    </div>
                  ))}
                  {duplicateWarning.groups.length > 3 && (
                    <div className="text-zinc-400 text-xs text-center">还有 {duplicateWarning.groups.length - 3} 个...</div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setDuplicateWarning(null); setPendingSubmit(false); }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 font-bold text-sm"
                >
                  取消
                </button>
                <button
                  onClick={() => { setDuplicateWarning(null); doSubmit(); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold text-sm"
                >
                  继续发起
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS风格时间选择器 */}
      <WheelPicker
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(date) => setDeadline(date)}
        initialDate={deadline}
      />
    </div>
  );
}
