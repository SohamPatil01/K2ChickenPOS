'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the html.dark class (toggled by ThemeSettings and the
 * pre-hydration script). SVG chart libraries need concrete colors —
 * CSS vars don't resolve in SVG presentation attributes — so charts
 * use this to pick the mode-specific hex.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
