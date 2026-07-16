'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { dur, ease, useMotionSafe } from '@/lib/motion';

/**
 * Enter-only page transition (App Router template.tsx remounts per
 * navigation; exit animations are intentionally not used). Renders a
 * plain div under reduced motion / low-end hardware.
 */
export const PageTransition: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  const motionSafe = useMotionSafe();

  if (!motionSafe) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease }}
    >
      {children}
    </motion.div>
  );
};
