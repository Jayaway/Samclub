import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Users, TrendingUp, Camera, X, ShieldCheck, Phone } from 'lucide-react';
import { springConfig, springBouncy } from '../utils/animations';
import { sendVerificationCode } from '../utils/api';

interface LoginPageProps {
  onLogin: (studentId: string, nickname?: string, dormBuilding?: string, phone?: string, code?: string, avatarUrl?: string) => Promise<void>;
  error?: string;
  compact?: boolean;
}

// 验证码倒计时 Hook
function useCountdown(initialSeconds: number = 60) {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setSeconds(initialSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initialSeconds]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return { seconds, start, isCounting: seconds > 0 };
}

// 验证码输入框组件
function CodeInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.split('').slice(0, 6);
  const handleClick = () => inputRef.current?.focus();

  return (
    <div>
      <div className="flex gap-2 justify-center" onClick={handleClick}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${
              digits[i]
                ? 'border-cyan-400 bg-cyan-50 text-cyan-600'
                : error
                  ? 'border-red-300 bg-red-50'
                  : 'border-zinc-200 bg-zinc-50'
            } ${i === digits.length ? 'border-cyan-300' : ''}`}
          >
            {digits[i] || ''}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="sr-only"
        autoFocus
      />
      {error && <p className="text-red-500 text-[10px] mt-1.5 text-center">{error}</p>}
    </div>
  );
}

export default function LoginPage({ onLogin, error: externalError, compact = false }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [studentId, setStudentId] = useState('');
  const [nickname, setNickname] = useState('');
  const [dormBuilding, setDormBuilding] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [studentIdError, setStudentIdError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [showPhone, setShowPhone] = useState(false); // 是否展开手机号绑定

  const { seconds, start: startCountdown, isCounting } = useCountdown(60);

  const validateStudentId = (id: string) => {
    if (!id.trim()) return '请填写学号';
    if (!/^(b|B|f|F)\d{8}$/.test(id.trim())) return '学号格式：B/F + 8位数字（不区分大小写）';
    return '';
  };

  const validatePhone = (p: string) => {
    if (!p.trim()) return '';
    if (!/^1[3-9]\d{9}$/.test(p.trim())) return '手机号格式不正确';
    return '';
  };

  const handleSendCode = async () => {
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) return;

    setSendingCode(true);
    setError('');
    try {
      const result = await sendVerificationCode(phone);
      if (result.success) {
        startCountdown();
        if (result.code) {
          setVerifyCode(result.code);
        }
      } else {
        setError(result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '发送失败';
      setError(msg);
    } finally {
      setSendingCode(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('头像图片不能超过2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => setAvatar(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCodeError('');
    setStudentIdError('');
    setPhoneError('');

    // 学号校验（登录和注册都需要）
    const sidErr = validateStudentId(studentId);
    if (sidErr) { setStudentIdError(sidErr); return; }

    if (mode === 'register') {
      if (!nickname.trim()) { setError('请填写昵称'); return; }
      // 手机号选填，但填了需要验证码
      if (phone.trim() && !verifyCode.trim()) {
        setCodeError('填写手机号需要验证码');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(studentId.trim());
      } else {
        await onLogin(
          studentId.trim(),
          nickname.trim(),
          dormBuilding.trim(),
          phone.trim() || undefined,
          verifyCode.trim() || undefined,
          avatar || undefined
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const displayError = externalError || error;

  // ============ 紧凑模式（弹窗） ============
  if (compact) {
    return (
      <div className="w-full">
        {/* 模式切换 */}
        <div className="flex bg-zinc-100 rounded-xl p-1 mb-4">
          <button type="button" onClick={() => { setMode('login'); setError(''); setCodeError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'login' ? 'bg-white text-[#0c0c0c] shadow-sm' : 'text-zinc-500'}`}>
            登录
          </button>
          <button type="button" onClick={() => { setMode('register'); setError(''); setCodeError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'register' ? 'bg-white text-[#0c0c0c] shadow-sm' : 'text-zinc-500'}`}>
            注册
          </button>
        </div>

        {displayError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl mb-3">{displayError}</motion.div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* 学号 */}
          <div>
            <label className="text-zinc-500 text-xs font-medium block mb-1">学号 <span className="text-red-400">*</span></label>
            <input type="text" value={studentId} onChange={(e) => { setStudentId(e.target.value); setStudentIdError(''); }}
              placeholder="B25011215" maxLength={9}
              className={`w-full bg-zinc-50 border ${studentIdError ? 'border-red-300' : 'border-zinc-200'} text-[#0c0c0c] placeholder-zinc-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition-all`} />
            {studentIdError && <p className="text-red-500 text-[10px] mt-1">{studentIdError}</p>}
          </div>

          {/* 注册额外字段 */}
          {mode === 'register' && (
            <>
              <div>
                <label className="text-zinc-500 text-xs font-medium block mb-1">昵称 <span className="text-red-400">*</span></label>
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                  placeholder="给自己起个名字"
                  className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] placeholder-zinc-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition-all" />
              </div>
              <div>
                <label className="text-zinc-500 text-xs font-medium block mb-1">宿舍地址</label>
                <input type="text" value={dormBuilding} onChange={(e) => setDormBuilding(e.target.value)}
                  placeholder="如 3栋205室"
                  className="w-full bg-zinc-50 border border-zinc-200 text-[#0c0c0c] placeholder-zinc-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition-all" />
              </div>

              {/* 手机号（选填） */}
              <div>
                <button type="button" onClick={() => setShowPhone(!showPhone)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
                  <Phone size={12} />
                  {showPhone ? '收起手机号绑定' : '绑定手机号（选填）'}
                </button>
                {showPhone && (
                  <div className="flex flex-col gap-2">
                    <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                      placeholder="手机号" maxLength={11}
                      className={`w-full bg-zinc-50 border ${phoneError ? 'border-red-300' : 'border-zinc-200'} text-[#0c0c0c] placeholder-zinc-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 transition-all`} />
                    {phoneError && <p className="text-red-500 text-[10px]">{phoneError}</p>}
                    {/^1[3-9]\d{9}$/.test(phone) && (
                      <>
                        <CodeInput value={verifyCode} onChange={(v) => { setVerifyCode(v); setCodeError(''); }} error={codeError} />
                        <button type="button" onClick={handleSendCode} disabled={sendingCode || isCounting}
                          className="w-full py-2 text-xs font-medium rounded-lg border border-cyan-200 text-cyan-600 bg-cyan-50 disabled:opacity-40">
                          {sendingCode ? '发送中...' : isCounting ? `${seconds}s 后重新发送` : '获取验证码'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <button type="submit" disabled={loading}
            className="mt-1 w-full bg-gradient-to-r from-cyan-500 to-sky-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-cyan-500/20">
            {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>
      </div>
    );
  }

  // ============ 完整模式（独立页面） ============
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0f1e] flex flex-col">
      {/* 背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.2 }} transition={{ ...springBouncy, delay: 0.2 }}
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500 blur-3xl" />
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.15 }} transition={{ ...springBouncy, delay: 0.4 }}
          className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-sky-400 blur-3xl" />
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.1 }} transition={{ ...springBouncy, delay: 0.6 }}
          className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-teal-400 blur-3xl" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 0.03 }} transition={{ ...springBouncy, delay: 0.3 }}
          className="text-[22vw] font-black text-white leading-none tracking-tighter">拼</motion.span>
      </div>

      {/* 标签 */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.3 }}
        className="absolute top-16 right-6 pointer-events-none">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.5 }}
          className="bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm tracking-widest uppercase">Free Ship</motion.div>
      </motion.div>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.4 }}
        className="absolute top-28 left-4 pointer-events-none">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.6 }}
          className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">¥99 解锁</motion.div>
      </motion.div>

      <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.5 }}
        className="absolute bottom-1/3 left-4 pointer-events-none flex flex-col gap-2">
        {[
          { icon: <ShieldCheck size={12} />, text: '学号登录' },
          { icon: <Users size={12} />, text: '安全可靠' },
          { icon: <TrendingUp size={12} />, text: '满99免运费' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.6 + i * 0.1 }}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/60 text-xs px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
            {s.icon}<span>{s.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* 主内容 */}
      <div className="relative z-10 flex flex-col min-h-screen px-6 pt-20 pb-10">
        <div className="flex-1 flex flex-col justify-center mb-6">
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...springBouncy, delay: 0.2 }} className="mb-5">
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...springBouncy, delay: 0.3 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shadow-2xl shadow-cyan-500/40 mb-5">
              <ShoppingCart size={30} className="text-white" />
            </motion.div>
            <div className="flex items-center gap-2 mb-2">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.4 }}
                className="bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase">Campus</motion.span>
              <motion.div initial={{ scale: 0, rotate: 180 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...springBouncy, delay: 0.5 }}>
                <Zap size={14} className="text-amber-400" />
              </motion.div>
            </div>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.35 }}
              className="text-4xl font-black text-white leading-tight tracking-tight mb-1">
              校园山姆<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">拼单平台</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-white/40 text-sm font-medium tracking-wide mt-3">
              平台统一下单 · 满 <span className="text-amber-400 font-bold">¥99</span> 免运费
            </motion.p>
          </motion.div>
        </div>

        {/* 表单卡片 */}
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...springBouncy, delay: 0.4 }}
          className="bg-white/[0.07] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
          {/* 模式切换 */}
          <div className="flex bg-white/10 rounded-xl p-1 mb-4">
            <button type="button" onClick={() => { setMode('login'); setError(''); setCodeError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'login' ? 'bg-white/20 text-white' : 'text-white/40'}`}>
              登录
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(''); setCodeError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'register' ? 'bg-white/20 text-white' : 'text-white/40'}`}>
              注册
            </button>
          </div>

          <motion.h2 initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.5 }}
            className="text-white font-bold text-lg mb-0.5">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
            className="text-white/40 text-xs mb-4">
            {mode === 'login' ? '输入学号即可登录' : '填写信息注册新账号'}
          </motion.p>

          {displayError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs px-3 py-2 rounded-xl mb-4">{displayError}</motion.div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* 头像（仅注册） */}
            {mode === 'register' && (
              <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.55 }}
                className="flex flex-col items-center mb-1">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-dashed border-white/20 overflow-hidden flex items-center justify-center">
                    {avatar ? <img src={avatar} alt="头像" className="w-full h-full object-cover" /> : <Camera size={24} className="text-white/30" />}
                  </div>
                  <label className="absolute inset-0 cursor-pointer"><input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"><Camera size={20} className="text-white" /></div>
                  </label>
                  {avatar && <button type="button" onClick={() => setAvatar(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"><X size={12} /></button>}
                </div>
                <span className="text-white/30 text-[10px] mt-1.5">点击上传头像</span>
              </motion.div>
            )}

            {/* 学号（登录和注册都有） */}
            <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.6 }}>
              <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">
                学号 <span className="text-red-400">*</span>
              </label>
              <input type="text" value={studentId} onChange={(e) => { setStudentId(e.target.value); setStudentIdError(''); }}
                placeholder={mode === 'login' ? '输入你的学号' : 'B25011215 或 F25011215'} maxLength={9}
                className={`w-full bg-white/10 border ${studentIdError ? 'border-red-500/50' : 'border-white/15'} text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all`} />
              {studentIdError && <p className="text-red-400 text-[10px] mt-1">{studentIdError}</p>}
            </motion.div>

            {/* 注册：昵称 */}
            {mode === 'register' && (
              <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.63 }}>
                <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">昵称 <span className="text-red-400">*</span></label>
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                  placeholder="给自己起个好听的名字"
                  className="w-full bg-white/10 border border-white/15 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all" />
              </motion.div>
            )}

            {/* 注册：宿舍地址 */}
            {mode === 'register' && (
              <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.66 }}>
                <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">
                  宿舍地址 <span className="text-white/30 normal-case">(选填，如 3栋205室)</span>
                </label>
                <input type="text" value={dormBuilding} onChange={(e) => setDormBuilding(e.target.value)}
                  placeholder="用于取货"
                  className="w-full bg-white/10 border border-white/15 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all" />
              </motion.div>
            )}

            {/* 注册：手机号绑定（选填，可展开） */}
            {mode === 'register' && (
              <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.69 }}>
                <button type="button" onClick={() => setShowPhone(!showPhone)}
                  className="flex items-center gap-1.5 text-white/40 text-xs mb-1.5 hover:text-white/60 transition-colors">
                  <Phone size={12} />
                  {showPhone ? '收起手机号绑定' : '绑定手机号（选填，用于找回账号）'}
                </button>
                {showPhone && (
                  <div className="flex flex-col gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
                    <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                      placeholder="输入手机号" maxLength={11}
                      className={`w-full bg-white/10 border ${phoneError ? 'border-red-500/50' : 'border-white/15'} text-white placeholder-white/25 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60 transition-all`} />
                    {phoneError && <p className="text-red-400 text-[10px]">{phoneError}</p>}
                    {/^1[3-9]\d{9}$/.test(phone) && (
                      <>
                        <CodeInput value={verifyCode} onChange={(v) => { setVerifyCode(v); setCodeError(''); }} error={codeError} />
                        <button type="button" onClick={handleSendCode} disabled={sendingCode || isCounting}
                          className="w-full py-2 text-xs font-bold rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 disabled:opacity-30 hover:bg-cyan-400/20 transition-all">
                          {sendingCode ? '发送中...' : isCounting ? `${seconds}s 后重新发送` : '获取验证码'}
                        </button>
                        <p className="text-white/20 text-[10px]">验证码5分钟内有效</p>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* 提交按钮 */}
            <motion.button type="submit" disabled={loading}
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...springConfig, delay: 0.75 }}
              whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.96 }}
              className="mt-2 w-full bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-base shadow-lg shadow-cyan-500/30">
              {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册并登录'}
            </motion.button>
          </form>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="text-white/20 text-xs text-center mt-4">
          登录即表示同意《用户服务协议》
        </motion.p>
      </div>
    </div>
  );
}
