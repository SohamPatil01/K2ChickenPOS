'use client';

import { useEffect, useMemo, useState } from 'react';

function randomDigit() {
  return Math.floor(Math.random() * 10);
}

type DigitReelProps = {
  /** Final digit 0–9, or null while still loading / spinning */
  digit: number | null;
  /** Delay before this reel starts settling (ms) */
  settleDelay: number;
  /** How long the settle spin lasts after delay (ms) */
  settleDuration?: number;
};

function DigitReel({ digit, settleDelay, settleDuration = 280 }: DigitReelProps) {
  const [shown, setShown] = useState(randomDigit);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (digit === null) {
      setLocked(false);
      if (reduced) return;
      const id = window.setInterval(() => setShown(randomDigit()), 32);
      return () => window.clearInterval(id);
    }

    if (reduced) {
      setShown(digit);
      setLocked(true);
      return;
    }

    setLocked(false);
    let settleFrame = 0;
    let lastFlip = 0;

    const spinId = window.setInterval(() => setShown(randomDigit()), 32);

    const delayId = window.setTimeout(() => {
      window.clearInterval(spinId);
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= settleDuration) {
          setShown(digit);
          setLocked(true);
          return;
        }
        const progress = elapsed / settleDuration;
        const interval = 28 + progress * 70;
        if (now - lastFlip >= interval) {
          lastFlip = now;
          setShown(randomDigit());
        }
        settleFrame = requestAnimationFrame(tick);
      };
      settleFrame = requestAnimationFrame(tick);
    }, settleDelay);

    return () => {
      window.clearTimeout(delayId);
      window.clearInterval(spinId);
      cancelAnimationFrame(settleFrame);
    };
  }, [digit, settleDelay, settleDuration]);

  return (
    <span
      className={`inline-block w-[0.62em] text-center transition-[filter,opacity] duration-200 ${
        locked ? 'opacity-100' : 'opacity-75 points-digit-spin'
      }`}
    >
      {shown}
    </span>
  );
}

type PointsReelsProps = {
  /** Final points value, or null while API is loading */
  value: number | null;
  /** Digits to show while loading (visual width) */
  loadingDigits?: number;
};

export function PointsReels({ value, loadingDigits = 3 }: PointsReelsProps) {
  const digits = useMemo(() => {
    if (value === null) {
      return Array.from({ length: loadingDigits }, () => null as number | null);
    }
    const str = String(Math.max(0, Math.round(value)));
    return str.split('').map((c) => Number(c)) as (number | null)[];
  }, [value, loadingDigits]);

  // When value arrives, pad/re-key so reels remount cleanly per length
  const key = value === null ? 'loading' : `v-${value}`;

  return (
    <p
      key={key}
      className="mt-3 font-display text-[5.5rem] sm:text-[6.5rem] font-extrabold leading-none tracking-tight tabular-nums text-ink flex justify-start"
      aria-label={value === null ? 'Loading points' : `${value} points`}
      aria-live="polite"
    >
      {digits.map((d, i) => (
        <DigitReel
          key={`${key}-${i}`}
          digit={d}
          // Left digits lock first; rightmost keeps spinning a beat longer
          settleDelay={value === null ? 0 : 40 + i * 70}
          settleDuration={180 + i * 40}
        />
      ))}
    </p>
  );
}
