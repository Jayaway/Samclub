import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { springBouncy } from '../utils/animations';

interface WheelPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate: Date;
}

export default function WheelPicker({ visible, onClose, onConfirm, initialDate }: WheelPickerProps) {
  const minuteOptions = [0, 15, 30, 45];

  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || getDefaultDate());
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const itemHeight = 56; // Taller items = slower scroll

  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate || getDefaultDate());
    }
  }, [visible, initialDate]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getMinuteIndex = (minute: number) => {
    const idx = minuteOptions.indexOf(minute);
    return idx >= 0 ? idx : 0;
  };

  const selectedHour = selectedDate.getHours();
  const selectedMinute = selectedDate.getMinutes();

  const handleConfirm = () => {
    onConfirm(selectedDate);
    onClose();
  };

  const handleHourScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(hours.length - 1, index));
    const newDate = new Date(selectedDate);
    newDate.setHours(hours[clampedIndex]);
    setSelectedDate(newDate);
  }, [selectedDate, hours]);

  const handleMinuteScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(minuteOptions.length - 1, index));
    const newDate = new Date(selectedDate);
    newDate.setMinutes(minuteOptions[clampedIndex]);
    setSelectedDate(newDate);
  }, [selectedDate, minuteOptions]);

  // Sync scroll position when selection changes externally
  useEffect(() => {
    if (hourRef.current && visible) {
      const targetScroll = hours.indexOf(selectedHour) * itemHeight;
      if (Math.abs(hourRef.current.scrollTop - targetScroll) > 1) {
        hourRef.current.scrollTo({ top: targetScroll, behavior: 'auto' as ScrollBehavior });
      }
    }
  }, [selectedHour, visible]);

  useEffect(() => {
    if (minuteRef.current && visible) {
      const targetScroll = getMinuteIndex(selectedMinute) * itemHeight;
      if (Math.abs(minuteRef.current.scrollTop - targetScroll) > 1) {
        minuteRef.current.scrollTo({ top: targetScroll, behavior: 'auto' as ScrollBehavior });
      }
    }
  }, [selectedMinute, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springBouncy}
            className="bg-white rounded-t-3xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"
              >
                <X size={18} />
              </button>
              <h3 className="font-black text-[#0c0c0c]">选择截止时间</h3>
              <button
                onClick={handleConfirm}
                className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white"
              >
                <Check size={18} />
              </button>
            </div>

            {/* Date Display */}
            <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-sky-50">
              <div className="text-center">
                <div className="text-lg font-black text-[#0c0c0c]">
                  {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                </div>
                <div className="text-cyan-600 text-sm font-medium mt-1">
                  截止时间：{String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Wheel Picker Container */}
            <div className="flex h-[224px] relative">
              {/* Top gradient overlay */}
              <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-white to-transparent z-20 pointer-events-none" />

              {/* Bottom gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white to-transparent z-20 pointer-events-none" />

              {/* Selection indicator bar */}
              <div className="absolute top-1/2 left-2 right-2 h-14 -translate-y-1/2 bg-cyan-50/80 rounded-xl z-10 pointer-events-none border border-cyan-100" />

              {/* Hour Wheel */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  ref={hourRef}
                  className="h-full overflow-y-auto scrollbar-hide"
                  onScroll={handleHourScroll}
                >
                  <div className="h-[84px]" />
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="h-14 flex items-center justify-center"
                    >
                      <span
                        className={`text-2xl font-bold transition-all duration-200 ${
                          hour === selectedHour
                            ? 'text-cyan-600 scale-110'
                            : 'text-zinc-300 scale-100'
                        }`}
                      >
                        {String(hour).padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                  <div className="h-[84px]" />
                </div>
              </div>

              {/* Separator */}
              <div className="w-12 flex items-center justify-center">
                <span className="text-3xl font-black text-zinc-200">:</span>
              </div>

              {/* Minute Wheel */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  ref={minuteRef}
                  className="h-full overflow-y-auto scrollbar-hide"
                  onScroll={handleMinuteScroll}
                >
                  <div className="h-[84px]" />
                  {minuteOptions.map((minute) => (
                    <div
                      key={minute}
                      className="h-14 flex items-center justify-center"
                    >
                      <span
                        className={`text-2xl font-bold transition-all duration-200 ${
                          minute === selectedMinute
                            ? 'text-cyan-600 scale-110'
                            : 'text-zinc-300 scale-100'
                        }`}
                      >
                        {String(minute).padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                  <div className="h-[84px]" />
                </div>
              </div>
            </div>

            {/* Quick Select Buttons */}
            <div className="px-4 py-4 border-t border-zinc-100 flex gap-3">
              {[2, 4, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    d.setMinutes(Math.round(d.getMinutes() / 15) * 15);
                    d.setSeconds(0);
                    setSelectedDate(d);
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-bold hover:bg-zinc-200 transition-colors active:scale-95"
                >
                  +{days}天
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}