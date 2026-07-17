'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';

type ThemeMode = 'light' | 'dark' | 'system';

export default function ThemeSettings() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load saved theme from localStorage
    const rawTheme = localStorage.getItem('theme');
    if (rawTheme === 'light' || rawTheme === 'dark' || rawTheme === 'system') {
      setTheme(rawTheme);
    }

    // Detect system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemPreference = () => {
      setSystemPreference(mediaQuery.matches ? 'dark' : 'light');
    };
    
    updateSystemPreference();

    const handleChange = (e: MediaQueryListEvent) => {
      updateSystemPreference();
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (mounted) {
      applyTheme(theme);
    }
  }, [theme, systemPreference, mounted]);

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    const effectiveTheme = mode === 'system' ? systemPreference : mode;

    // Remove both light and dark classes first
    root.classList.remove('light', 'dark');
    
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }

    localStorage.setItem('theme', mode);
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  const themeOptions: { value: ThemeMode; label: string; description: string; icon: string }[] = [
    { value: 'light', label: 'Light', description: 'Always use light mode', icon: '☀️' },
    { value: 'dark', label: 'Dark', description: 'Always use dark mode', icon: '🌙' },
    { value: 'system', label: 'System', description: 'Follow system preference', icon: '💻' },
  ];

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Card hasAccent>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Theme Settings</h2>
          <p className="text-gray-600 text-sm mt-1">Choose your preferred theme mode</p>
        </div>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </Card>
    );
  }

  return (
    <Card hasAccent>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Theme Settings</h2>
        <p className="text-gray-600 text-sm mt-1">Choose your preferred theme mode</p>
      </div>

      <div className="space-y-4">
        {themeOptions.map((option) => (
          <div
            key={option.value}
            onClick={() => handleThemeChange(option.value)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${ theme === option.value ? 'border-brand-500 bg-brand-50 dark:bg-gray-800' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700' }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{option.icon}</span>
                <div>
                  <div className="font-semibold text-ink">{option.label}</div>
                  <div className="text-sm text-ink-secondary">{option.description}</div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${theme === option.value ? 'border-brand-500' : 'border-gray-300 dark:border-gray-600'}`}
              >
                {theme === option.value && (
                  <div className="w-3 h-3 rounded-full bg-brand-500" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {theme === 'system' && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-ink-secondary">
            Current system preference: <span className="font-semibold">{systemPreference}</span>
          </p>
        </div>
      )}
    </Card>
  );
}
