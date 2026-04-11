import { useState, useEffect } from 'react';
import { ArrowLeft, Minus, Plus, ShoppingBag, Snowflake, Tag, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { fetchGroupBuyById, fetchMyOrders, addOrderItem, removeOrderItem } from '../utils/api';

interface ShopPageProps {
  groupId: number;
  userId: number;
  onBack: () => void;
  onConfirm: () => void;
}

const categoryColors: Record<string, string> = {
  生鲜: 'bg-teal-100 text-teal-700',
  烘焙: 'bg-amber-100 text-amber-700',
  乳品: 'bg-sky-100 text-sky-700',
  零食: 'bg-rose-100 text-rose-700',
};

interface LocalProduct extends Product {
  myQuantity: number;
  myOrderId?: number;
}

export default function ShopPage({ groupId, userId, onBack, onConfirm }: ShopPageProps) {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [groupData, setGroupData] = useState<any>(null);

  const currentAmount = groupData?.total_amount || 0;
  const target = 99;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [group, orders] = await Promise.all([
          fetchGroupBuyById(groupId),
          fetchMyOrders(userId, groupId),
        ]);
        setGroupData(group);

        // Map products with user's existing orders
        const orderMap: Record<number, { quantity: number; id: number }> = {};
        orders.forEach((o: any) => {
          orderMap[o.product_id] = { quantity: o.quantity, id: o.id };
        });

        const mappedProducts: LocalProduct[] = (group.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          unitPrice: p.unit_price || p.unitPrice,
          category: getCategory(p.name),
          remaining: p.remaining_quantity || p.remaining,
          total: p.total_quantity || p.total,
          isFresh: Boolean(p.is_frozen || p.isFresh),
          quantity: 0,
          myQuantity: orderMap[p.id]?.quantity || 0,
          myOrderId: orderMap[p.id]?.id,
        }));

        setProducts(mappedProducts);
      } catch (err) {
        console.error('Failed to load shop data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [groupId, userId]);

  function getCategory(name: string): string {
    const freshKeywords = ['草莓', '牛奶', '鲜', '肉', '鱼', '虾', '水果'];
    const bakeryKeywords = ['卷', '蛋糕', '面包', '烘焙'];
    const dairyKeywords = ['奶', '酸奶', '芝士'];
    const snackKeywords = ['薯片', '坚果', '零食', '饼干'];

    for (const kw of freshKeywords) if (name.includes(kw)) return '生鲜';
    for (const kw of bakeryKeywords) if (name.includes(kw)) return '烘焙';
    for (const kw of dairyKeywords) if (name.includes(kw)) return '乳品';
    for (const kw of snackKeywords) if (name.includes(kw)) return '零食';
    return '其他';
  }

  const totalSelected = products.reduce((s, p) => s + p.myQuantity * p.unitPrice, 0);
  const selectedCount = products.reduce((s, p) => s + p.myQuantity, 0);
  const newTotal = currentAmount + totalSelected;
  const pct = Math.min(100, Math.round((newTotal / target) * 100));
  const remaining = Math.max(0, target - newTotal);

  const updateQty = async (product: LocalProduct, delta: number) => {
    const current = product.myQuantity;
    const next = Math.max(0, Math.min(product.remaining, current + delta));

    if (next === current) return;

    try {
      if (product.myOrderId) {
        if (next === 0) {
          await removeOrderItem(product.myOrderId);
          product.myOrderId = undefined;
        } else {
          await addOrderItem({
            group_buy_id: groupId,
            user_id: userId,
            product_id: product.id,
            quantity: next,
          });
        }
      } else if (next > 0) {
        const result = await addOrderItem({
          group_buy_id: groupId,
          user_id: userId,
          product_id: product.id,
          quantity: next,
        });
        product.myOrderId = result.id;
      }

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== product.id) return p;
          return { ...p, myQuantity: next };
        })
      );
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col">
      {/* Top nav */}
      <div className="sticky top-0 z-20 bg-white border-b border-zinc-100 px-4 pt-12 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[#0c0c0c] font-black text-lg leading-none">选购商品</h1>
          <p className="text-zinc-400 text-xs mt-0.5">为拼单添加你的商品</p>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-36 flex flex-col gap-3">
        {/* Progress card */}
        <div className="bg-[#0a0f1e] rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-white/[0.04] text-[80px] font-black leading-none select-none pr-2">
            {pct}
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs font-medium">凑单进度</span>
              <span className="text-cyan-400 font-black text-sm">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-white text-xl font-black">¥{newTotal.toFixed(1)}</span>
                <span className="text-white/30 text-sm"> / ¥{target}</span>
              </div>
              {remaining > 0 ? (
                <span className="text-amber-400 text-xs font-bold bg-amber-400/15 px-2 py-1 rounded-lg">
                  还差 ¥{remaining.toFixed(1)} 免运费
                </span>
              ) : (
                <span className="text-emerald-400 text-xs font-bold bg-emerald-400/15 px-2 py-1 rounded-lg">
                  已解锁免运费
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="flex items-center gap-2">
          <span className="text-[#0c0c0c] font-black text-base">选择商品</span>
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-zinc-400 text-xs">{products.length} 件在售</span>
        </div>

        {/* Products */}
        {products.map((p) => (
          <div
            key={p.id}
            className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
              p.myQuantity > 0 ? 'border-cyan-300 shadow-cyan-100' : 'border-transparent'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${categoryColors[p.category] ?? 'bg-zinc-100 text-zinc-500'}`}
                  >
                    {p.category}
                  </span>
                  {p.isFresh && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-50 text-cyan-600 flex items-center gap-0.5">
                      <Snowflake size={9} />
                      生鲜
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400">
                    剩 {p.remaining}/{p.total}
                  </span>
                </div>
                <h3 className="text-[#0c0c0c] font-bold text-sm leading-tight">{p.name}</h3>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-orange-500 font-black text-xl leading-none">
                  ¥{p.unitPrice}
                </div>
                <div className="text-zinc-400 text-[10px]">/件</div>
              </div>
            </div>

            {/* Qty controls */}
            <div className="flex items-center justify-between mt-3">
              {p.myQuantity > 0 && (
                <div className="flex items-center gap-1 text-zinc-500 text-xs">
                  <Tag size={11} />
                  小计 <span className="font-bold text-zinc-700">¥{(p.myQuantity * p.unitPrice).toFixed(1)}</span>
                </div>
              )}
              <div className={`flex items-center gap-2 ${p.myQuantity === 0 ? 'ml-auto' : ''}`}>
                <button
                  onClick={() => updateQty(p, -1)}
                  disabled={p.myQuantity === 0}
                  className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 disabled:opacity-30 active:scale-90 transition-transform"
                >
                  <Minus size={14} />
                </button>
                <span className="text-[#0c0c0c] font-black text-base w-5 text-center">
                  {p.myQuantity}
                </span>
                <button
                  onClick={() => updateQty(p, 1)}
                  disabled={p.myQuantity >= p.remaining}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-transform shadow-md shadow-cyan-500/20"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom cart */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        {selectedCount > 0 && (
          <div className="bg-cyan-50 border-t border-cyan-200 px-5 py-2 flex items-center gap-2">
            <ShoppingBag size={14} className="text-cyan-600" />
            <span className="text-cyan-700 text-xs font-medium">
              已选 <span className="font-black">{selectedCount}</span> 件商品
            </span>
            <span className="ml-auto text-cyan-700 font-black text-sm">
              ¥{totalSelected.toFixed(2)}
            </span>
          </div>
        )}
        <div className="bg-white border-t border-zinc-100 px-5 py-3 flex items-center justify-between pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div>
            <div className="text-zinc-400 text-xs">应付总额</div>
            <div className="text-[#0c0c0c] font-black text-2xl leading-none">
              ¥{totalSelected.toFixed(2)}
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0 || submitting}
            className="bg-gradient-to-r from-cyan-500 to-sky-600 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-xl text-sm active:scale-95 transition-all shadow-lg shadow-cyan-500/20"
          >
            {submitting ? '提交中...' : '确认加入'}
          </button>
        </div>
      </div>
    </div>
  );
}
