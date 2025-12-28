'use client';

import { useState, useEffect } from 'react';
import HQLayout from '@/components/HQLayout';
import ThemeSettings from './components/ThemeSettings';

type TabId = 'theme';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'theme', label: 'Theme', icon: '🎨' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('theme');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <HQLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 dark:text-white">Settings</h1>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Settings</h1>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'theme' && <ThemeSettings />}
        </div>
      </div>
    </HQLayout>
  );
}

