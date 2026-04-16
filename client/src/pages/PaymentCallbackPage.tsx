import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { fetchAlipayStatus } from '../utils/api';
import { springConfig, springBouncy } from '../utils/animations';

export default function PaymentCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const tradeNo = params.get('trade_no') || '';
  const outTradeNo = params.get('out_trade_no') || '';

  const [polling, setPolling] = useState(false);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === 'success' && tradeNo) {
      // Poll for payment confirmation from server
      setPolling(true);
      let attempts = 0;
      const maxAttempts = 10;

      const poll = async () => {
        try {
          const result = await fetchAlipayStatus(outTradeNo);
          if (result.status === 'TRADE_SUCCESS' || result.status === 'TRADE_FINISHED') {
            setPayStatus('success');
            setPolling(false);
            return;
          }
        } catch {
          // continue polling
        }
        attempts++;
        if (attempts < maxAttempts) {
          timeoutRef.current = setTimeout(poll, 1500);
        } else {
          setPolling(false);
        }
      };

      poll();
    } else if (status === 'cancelled') {
      setPayStatus('cancelled');
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [status, tradeNo, outTradeNo]);

  const isSuccess = status === 'success' || payStatus === 'success';
  const isCancelled = status === 'cancelled' || payStatus === 'cancelled';

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springBouncy}
        className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-xl"
      >
        {isSuccess ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5"
            >
              <CheckCircle size={48} className="text-emerald-500" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-[#0c0c0c] font-black text-2xl mb-2"
            >
              支付成功
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-zinc-400 text-sm mb-1"
            >
              您的款项已支付，请等待团长确认
            </motion.p>
            {tradeNo && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-zinc-300 text-xs font-mono mb-6"
              >
                交易号：{tradeNo}
              </motion.p>
            )}
          </>
        ) : isCancelled ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-5"
            >
              <XCircle size={48} className="text-rose-500" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-[#0c0c0c] font-black text-2xl mb-2"
            >
              支付取消
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-zinc-400 text-sm mb-6"
            >
              您已取消支付，可返回拼单详情重新发起
            </motion.p>
          </>
        ) : polling ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-5"
            >
              <Loader2 size={48} className="text-cyan-500 animate-spin" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-[#0c0c0c] font-black text-2xl mb-2"
            >
              确认中
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-zinc-400 text-sm mb-6"
            >
              正在确认支付结果，请稍候...
            </motion.p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...springBouncy, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-5"
            >
              <XCircle size={48} className="text-zinc-400" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-[#0c0c0c] font-black text-2xl mb-2"
            >
              未知状态
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-zinc-400 text-sm mb-6"
            >
              支付状态未知，请联系团长确认
            </motion.p>
          </>
        )}

        <motion.button
          onClick={() => { window.location.href = '/'; }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
        >
          <ArrowLeft size={18} />
          返回首页
        </motion.button>
      </motion.div>
    </div>
  );
}
