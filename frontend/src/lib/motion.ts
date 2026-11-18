import type { Transition, Variants } from 'framer-motion';

export const EASE_SMOOTH: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
};

export const fadeUp = (reduced = false, delay = 0): Variants => ({
  hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: reduced ? 0.18 : 0.52,
      delay,
      ease: EASE_SMOOTH,
    },
  },
});

export const stagger = (staggerChildren = 0.08, delayChildren = 0.04): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const scaleIn = (reduced = false, delay = 0): Variants => ({
  hidden: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: reduced ? 0.16 : 0.42,
      delay,
      ease: EASE_SMOOTH,
    },
  },
});

export const floatY = (reduced = false, amplitude = 8, duration = 5.5, delay = 0) => {
  if (reduced) return {};
  return {
    y: [0, -amplitude, 0],
    transition: {
      duration,
      delay,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  };
};

export const pageTransition = (reduced = false) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: reduced ? { opacity: 0 } : { opacity: 0, y: -8 },
  transition: { duration: reduced ? 0.15 : 0.24, ease: EASE_SMOOTH },
});
