import type { Transition, Variants } from 'framer-motion';

export const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const instantTransition: Transition = { duration: 0 };

export const springConfig: Transition = prefersReducedMotion
  ? instantTransition
  : {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      mass: 1,
    };

export const springBouncy: Transition = prefersReducedMotion
  ? instantTransition
  : {
      type: 'spring',
      stiffness: 500,
      damping: 25,
      mass: 0.8,
    };

export const springGentle: Transition = prefersReducedMotion
  ? instantTransition
  : {
      type: 'spring',
      stiffness: 200,
      damping: 25,
      mass: 1,
    };

export const springSnappy: Transition = prefersReducedMotion
  ? instantTransition
  : {
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
      staggerChildren: prefersReducedMotion ? 0 : 0.08,
      delayChildren: prefersReducedMotion ? 0 : 0.1,
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
    transition: prefersReducedMotion ? instantTransition : springGentle,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion ? instantTransition : springBouncy,
  },
  exit: {
    opacity: 0,
    y: '100%',
    transition: prefersReducedMotion ? instantTransition : springGentle,
  },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
