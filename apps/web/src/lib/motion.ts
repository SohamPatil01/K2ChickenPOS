'use client';

/**
 * Shared motion system for the glass redesign.
 * Hard rules: nothing exceeds 300ms, transforms/opacity only
 * (never filter/backdrop-filter), and everything degrades to
 * static rendering under prefers-reduced-motion or html.no-blur.
 */
import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Variants } from 'framer-motion';

export const dur = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3, // hard ceiling
} as const;

export const ease = [0.16, 1, 0.3, 1] as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: dur.base, ease } },
};

export const staggerContainer = (stagger = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: 0.02 } },
});

export const hoverLift = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.98 },
  transition: { duration: dur.fast },
} as const;

/**
 * True when it is safe to animate: respects prefers-reduced-motion
 * and the html.no-blur low-end-hardware kill switch set at boot.
 * Returns false on the server/first paint so SSR markup is static.
 */
export function useMotionSafe(): boolean {
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!document.documentElement.classList.contains('no-blur'));
  }, []);

  return enabled && !reduced;
}
