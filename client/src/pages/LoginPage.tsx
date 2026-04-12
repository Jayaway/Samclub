import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Users, TrendingUp, Camera, X } from 'lucide-react';
import { springConfig, springBouncy } from '../utils/animations';

interface LoginPageProps {
  onLogin: (studentId: string, nickname: string, dormBuilding?: string, phone?: string, avatarUrl?: string) => Promise<void>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [studentId, setStudentId] = useState('');
  const [nickname, setNickname] = useState('');
  const [dormBuilding, setDormBuilding] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [studentIdError, setStudentIdError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // 校验学号格式（B/F + 8位数字，如 B25011215 或 F25011215）
  const validateStudentId = (id: string) => {
    if (!id.trim()) return '请填写学号';
    if (!/^(B|F)\d{8}$/.test(id.trim())) return '学号格式：B/F + 8位数字（如 B25011215）';
    return '';
  };

  // 校验手机号格式（可选，11位数字）
  const validatePhone = (p: string) => {
    if (p && !/^1[3-9]\d{9}$/.test(p.trim())) return '手机号格式不正确';
    return '';
  };

  // 处理头像上传
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('头像图片不能超过2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatar(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 校验学号
    const sidError = validateStudentId(studentId);
    if (sidError) {
      setStudentIdError(sidError);
      return;
    }
    setStudentIdError('');

    // 校验手机号
    const phError = validatePhone(phone);
    if (phError) {
      setPhoneError(phError);
      return;
    }
    setPhoneError('');

    if (!nickname.trim()) {
      setError('请填写昵称');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await onLogin(studentId.trim(), nickname.trim(), dormBuilding.trim(), phone.trim() || undefined, avatar || undefined);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0f1e] flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{ ...springBouncy, delay: 0.2 }}
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500 blur-3xl"
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.15 }}
          transition={{ ...springBouncy, delay: 0.4 }}
          className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-sky-400 blur-3xl"
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.1 }}
          transition={{ ...springBouncy, delay: 0.6 }}
          className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-teal-400 blur-3xl"
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.03 }}
          transition={{ ...springBouncy, delay: 0.3 }}
          className="text-[22vw] font-black text-white leading-none tracking-tighter"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          拼
        </motion.span>
      </div>

      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.3 }}
        className="absolute top-16 right-6 pointer-events-none"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...springBouncy, delay: 0.5 }}
          className="bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm tracking-widest uppercase"
        >
          Free Ship
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.4 }}
        className="absolute top-28 left-4 pointer-events-none"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...springBouncy, delay: 0.6 }}
          className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm"
        >
          ¥99 解锁
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.5 }}
        className="absolute bottom-1/3 left-4 pointer-events-none flex flex-col gap-2"
      >
        {[
          { icon: <Users size={12} />, text: '2,847 人参与' },
          { icon: <TrendingUp size={12} />, text: '今日 +128 单' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...springConfig, delay: 0.6 + i * 0.1 }}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/60 text-xs px-2.5 py-1.5 rounded-lg backdrop-blur-sm"
          >
            {s.icon}
            <span>{s.text}</span>
          </motion.div>
        ))}
      </motion.div>

      <div className="relative z-10 flex flex-col min-h-screen px-6 pt-20 pb-10">
        <div className="flex-1 flex flex-col justify-center mb-8">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...springBouncy, delay: 0.2 }}
            className="mb-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...springBouncy, delay: 0.3 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shadow-2xl shadow-cyan-500/40 mb-5"
            >
              <ShoppingCart size={30} className="text-white" />
            </motion.div>

            <div className="flex items-center gap-2 mb-2">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springBouncy, delay: 0.4 }}
                className="bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase"
              >
                Campus
              </motion.span>
              <motion.div
                initial={{ scale: 0, rotate: 180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...springBouncy, delay: 0.5 }}
              >
                <Zap size={14} className="text-amber-400" />
              </motion.div>
            </div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.35 }}
              className="text-4xl font-black text-white leading-tight tracking-tight mb-1"
            >
              校园山姆
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">
                拼单平台
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-white/40 text-sm font-medium tracking-wide mt-3"
            >
              平台统一下单 · 满 <span className="text-amber-400 font-bold">¥99</span> 免运费
            </motion.p>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springBouncy, delay: 0.4 }}
          className="bg-white/[0.07] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl"
        >
          <motion.h2
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...springConfig, delay: 0.5 }}
            className="text-white font-bold text-lg mb-1"
          >
            开始拼单
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="text-white/40 text-xs mb-5"
          >
            首次登录将自动注册账号
          </motion.p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs px-3 py-2 rounded-xl mb-4"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* 头像上传 */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.55 }}
              className="flex flex-col items-center mb-2"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-dashed border-white/20 overflow-hidden flex items-center justify-center">
                  {avatar ? (
                    <img src={avatar} alt="头像预览" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-white/30" />
                  )}
                </div>
                <label className="absolute inset-0 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                  </div>
                </label>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar(null)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <span className="text-white/30 text-[10px] mt-1.5">点击上传头像</span>
            </motion.div>

            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.6 }}
            >
              <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">
                学号 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => { setStudentId(e.target.value); setStudentIdError(''); }}
                placeholder="输入你的学号"
                maxLength={9}
                className={`w-full bg-white/10 border ${
                  studentIdError ? 'border-red-500/50' : 'border-white/15'
                } text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all`}
              />
              <p className="text-white/30 text-[10px] mt-1">格式：B25011215 或 F25011215</p>
              {studentIdError && (
                <p className="text-red-400 text-[10px] mt-1">{studentIdError}</p>
              )}
            </motion.div>
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.65 }}
            >
              <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">
                昵称
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="给自己起个好听的名字"
                className="w-full bg-white/10 border border-white/15 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all"
              />
            </motion.div>
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.7 }}
            >
              <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">
                宿舍地址 <span className="text-white/30 normal-case">(如 3栋205室)</span>
              </label>
              <input
                type="text"
                value={dormBuilding}
                onChange={(e) => setDormBuilding(e.target.value)}
                placeholder="新用户注册时填写"
                className="w-full bg-white/10 border border-white/15 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all"
              />
            </motion.div>
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.75 }}
            >
              <label className="text-white/50 text-xs font-medium block mb-1.5 tracking-wider uppercase">
                手机号 <span className="text-white/30 normal-case">(可选)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                placeholder="用于接收取货通知"
                maxLength={11}
                className={`w-full bg-white/10 border ${
                  phoneError ? 'border-red-500/50' : 'border-white/15'
                } text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/15 transition-all`}
              />
              {phoneError && (
                <p className="text-red-400 text-[10px] mt-1">{phoneError}</p>
              )}
            </motion.div>

            <motion.button
              type="submit"
              disabled={loading}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springConfig, delay: 0.75 }}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.96 }}
              className="mt-2 w-full bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-base shadow-lg shadow-cyan-500/30"
            >
              {loading ? '登录中...' : '立即登录 / 注册'}
            </motion.button>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-white/20 text-xs text-center mt-4"
        >
          登录即表示同意《用户服务协议》
        </motion.p>
      </div>
    </div>
  );
}
