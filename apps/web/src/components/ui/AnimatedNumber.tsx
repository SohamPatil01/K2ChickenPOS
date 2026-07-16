'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { useMotionSafe } from '@/lib/motion';

export interface AnimatedNumberProps {
  value: number;
  /** Formatter for display, e.g. formatInr. Defaults to en-IN locale string. */
  format?: (value: number) => string;
  /** Animation duration in seconds. Hard-capped at 0.3. */
  duration?: number;
  className?: string;
}

/**
 * Count-up number. Snaps instantly when motion is unsafe (reduced
 * motion / low-end hardware) or when values change in rapid
 * succession (e.g. consecutive barcode scans) so animations never
 * queue up behind cashier input.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  duration = 0.3,
  className,
}) => {
  const motionSafe = useMotionSafe();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const lastChangeRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;

    const now = performance.now();
    const rapid = now - lastChangeRef.current < 400;
    lastChangeRef.current = now;

    if (!motionSafe || rapid) {
      setDisplay(value);
      return;
    }

    const controls = animate(from, value, {
      duration: Math.min(duration, 0.3),
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setDisplay(value),
    });
    return () => controls.stop();
  }, [value, duration, motionSafe]);

  return <span className={className}>{format(display)}</span>;
};
