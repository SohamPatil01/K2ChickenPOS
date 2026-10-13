'use client';

import { useEffect } from 'react';

/** Keep the public book/track experience light regardless of POS theme prefs. */
export default function ForceLight() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    return () => {
      if (hadDark) root.classList.add('dark');
      root.style.colorScheme = '';
    };
  }, []);
  return null;
}
