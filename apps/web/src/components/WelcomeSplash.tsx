'use client';

import { useEffect, useState } from 'react';
import { APP_NAME } from '@azela-pos/shared';

/**
 * Post-login welcome screen. The login page sets
 * sessionStorage['azeela-welcome'] = <user name> right before
 * redirecting; on the next page load this overlay covers the app,
 * greets the user, then slides up and out. The flag is cleared on
 * read so refreshes never replay it.
 */
export const WELCOME_SPLASH_KEY = 'azeela-welcome';

const HOLD_MS = 1600;
const EXIT_MS = 550;

export default function WelcomeSplash() {
  const [name, setName] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let holdTimer: number | undefined;
    let exitTimer: number | undefined;
    try {
      const stored = sessionStorage.getItem(WELCOME_SPLASH_KEY);
      if (!stored) return;
      sessionStorage.removeItem(WELCOME_SPLASH_KEY);
      setName(stored);

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      holdTimer = window.setTimeout(
        () => {
          if (reduced) {
            setName(null);
          } else {
            setExiting(true);
            exitTimer = window.setTimeout(() => setName(null), EXIT_MS);
          }
        },
        reduced ? 900 : HOLD_MS
      );
    } catch {
      // sessionStorage unavailable — never block the app
      setName(null);
    }
    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(exitTimer);
    };
  }, []);

  if (name === null) return null;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-gradient-brand text-white overflow-hidden transition-transform ease-[cubic-bezier(0.16,1,0.3,1)] ${
        exiting ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{ transitionDuration: `${EXIT_MS}ms` }}
      aria-live="polite"
    >
      {/* Decorative rings, matching the login hero */}
      <div className="pointer-events-none absolute -top-28 -right-28 h-[26rem] w-[26rem] rounded-full border border-white/15" aria-hidden />
      <div className="pointer-events-none absolute -bottom-36 -left-24 h-[30rem] w-[30rem] rounded-full bg-white/5" aria-hidden />

      <span
        className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 border border-white/25 text-4xl font-bold backdrop-blur-sm shadow-2xl"
      >
        A
      </span>

      <h1
        className="animate-fade-in-up mt-6 text-3xl sm:text-4xl font-bold tracking-tight !text-white text-center px-6"
        style={{ animationDelay: '150ms', animationFillMode: 'both' }}
      >
        Welcome to {APP_NAME || 'AzeelaAiPos'}
      </h1>

      <p
        className="animate-fade-in-up mt-3 text-white/85 text-base sm:text-lg text-center px-6"
        style={{ animationDelay: '300ms', animationFillMode: 'both' }}
      >
        Hi {name.split(' ')[0]} — getting your store ready…
      </p>

      <div
        className="animate-fade-in-up mt-8 flex items-center gap-1.5"
        style={{ animationDelay: '450ms', animationFillMode: 'both' }}
        aria-hidden
      >
        <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
