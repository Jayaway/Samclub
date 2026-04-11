import { motion } from 'framer-motion';
import { Grid2x2 as Grid2X2, PlusSquare, User } from 'lucide-react';
import { Page } from '../types';
import { springConfig, springSnappy } from '../utils/animations';

interface BottomNavProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

const tabs = [
  { page: 'square' as Page, icon: Grid2X2, label: '广场' },
  { page: 'create' as Page, icon: PlusSquare, label: '发起' },
  { page: 'login' as Page, icon: User, label: '我的' },
];

export default function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springConfig}
      className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-zinc-100 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex">
        {tabs.map(({ page, icon: Icon, label }) => {
          const active = current === page;
          return (
            <motion.button
              key={page}
              onClick={() => onNavigate(page)}
              className="flex-1 flex flex-col items-center gap-1 py-3"
              whileTap={{ scale: 0.9 }}
              transition={springSnappy}
            >
              <motion.div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  active
                    ? 'bg-gradient-to-br from-cyan-500 to-sky-600 shadow-md shadow-cyan-500/30'
                    : 'bg-transparent'
                }`}
                layout
                transition={springConfig}
              >
                <motion.div
                  initial={false}
                  animate={{
                    scale: active ? 1.1 : 1,
                  }}
                  transition={springConfig}
                >
                  <Icon
                    size={20}
                    className={active ? 'text-white' : 'text-zinc-400'}
                    strokeWidth={active ? 2.5 : 1.5}
                  />
                </motion.div>
              </motion.div>
              <motion.span
                className={`text-[10px] font-semibold ${
                  active ? 'text-cyan-600' : 'text-zinc-400'
                }`}
                animate={{
                  scale: active ? 1.05 : 1,
                }}
                transition={springConfig}
              >
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
