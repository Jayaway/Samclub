import type { Transition, Variants } from 'framer-motion';

export const springConfig: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 1,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 25,
  mass: 0.8,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 1,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 35,
  mass: 0.5,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
};

export const buttonTap = {
  scale: 0.95,
  transition: springSnappy,
};

export const cardHover = {
  y: -4,
  scale: 1.02,
  transition: springConfig,
};

export const iconBounce: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.4,
      ease: 'easeInOut',
    },
  },
};

export const pulseGlow: Variants = {
  initial: { boxShadow: '0 0 0 0 rgba(6, 182, 212, 0.4)' },
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(6, 182, 212, 0.4)',
      '0 0 0 10px rgba(6, 182, 212, 0)',
      '0 0 0 0 rgba(6, 182, 212, 0)',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
    },
  },
};

export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    y: '100%',
    transition: springGentle,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springBouncy,
  },
  exit: {
    opacity: 0,
    y: '100%',
    transition: springGentle,
  },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
