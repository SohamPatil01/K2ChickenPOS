'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import ThemeSettings from '@/app/settings/components/ThemeSettings';
import BarcodeSettings from '@/app/settings/components/BarcodeSettings';
import StaffManagement from '@/app/settings/components/StaffManagement';
import ReportSettings from '@/app/settings/components/ReportSettings';

type SettingsTab = 'barcode' | 'theme' | 'staff' | 'reports';

export default function StoreSettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('theme');
  const [hasAccess, setHasAccess] = useState(false);

  // Define which tabs are available for each role
  const availableTabs: SettingsTab[] = user?.role === 'OWNER' 
    ? ['barcode', 'theme', 'staff', 'reports']
    : user?.role === 'MANAGER'
    ? ['theme', 'reports']
    : user?.role === 'CASHIER'
    ? ['theme']
    : [];

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Allow CASHIER, MANAGER, and OWNER to access settings
    if (['CASHIER', 'MANAGER', 'OWNER'].includes(user.role)) {
      setHasAccess(true);
    } else {
      router.push('/store');
    }
  }, [user, router]);

  // Set default tab if current tab is not available
  useEffect(() => {
    if (hasAccess && availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [hasAccess, activeTab, availableTabs]);

  if (!hasAccess || !user) {
    return null;
  }

  const tabs = [
    { id: 'barcode' as SettingsTab, label: 'Barcode Settings', icon: '📊', roles: ['OWNER'] },
    { id: 'theme' as SettingsTab, label: 'Theme', icon: '🎨', roles: ['CASHIER', 'MANAGER', 'OWNER'] },
    { id: 'staff' as SettingsTab, label: 'Staff', icon: '👥', roles: ['OWNER'] },
    { id: 'reports' as SettingsTab, label: 'Reports', icon: '📈', roles: ['OWNER', 'MANAGER'] },
  ].filter(tab => tab.roles.includes(user.role));

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Manage your preferences and configurations</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4 sm:mb-6">
        <nav className="flex space-x-4 sm:space-x-6 lg:space-x-8 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap touch-target
                ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="mr-1 sm:mr-2">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4 sm:mt-6">
        {activeTab === 'barcode' && <BarcodeSettings />}
        {activeTab === 'theme' && <ThemeSettings />}
        {activeTab === 'staff' && <StaffManagement />}
        {activeTab === 'reports' && <ReportSettings />}
      </div>
    </div>
  );
}
