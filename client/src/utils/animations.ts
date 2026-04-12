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
