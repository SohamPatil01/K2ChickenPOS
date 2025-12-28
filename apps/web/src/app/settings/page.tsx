'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui';

// Import staff management component
import StaffManagement from './components/StaffManagement';
import BarcodeSettings from './components/BarcodeSettings';
import ThemeSettings from './components/ThemeSettings';
import ReportSettings from './components/ReportSettings';

type SettingsTab = 'barcode' | 'theme' | 'staff' | 'reports';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('barcode');
  const [hasAccess, setHasAccess] = useState(false);

  // Define which tabs are available for each role (before conditional return)
  const availableTabs: SettingsTab[] = user?.role === 'OWNER' 
    ? ['barcode', 'theme', 'staff', 'reports']
    : user?.role === 'MANAGER'
    ? ['theme', 'reports']
    : [];

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Role-based access: OWNER has full access, MANAGER has limited access
    if (user.role === 'OWNER' || user.role === 'MANAGER') {
      setHasAccess(true);
    } else {
      alert('Access denied. Only Owners and Managers can access settings.');
      router.push('/pos');
    }
  }, [user, router]);

  // Set default tab if current tab is not available (must be before conditional return)
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
    { id: 'theme' as SettingsTab, label: 'Theme', icon: '🎨', roles: ['OWNER', 'MANAGER'] },
    { id: 'staff' as SettingsTab, label: 'Staff', icon: '👥', roles: ['OWNER'] },
    { id: 'reports' as SettingsTab, label: 'Reports', icon: '📈', roles: ['OWNER', 'MANAGER'] },
  ].filter(tab => tab.roles.includes(user.role));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your application preferences and configurations</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
        <div className="mt-6">
          {activeTab === 'barcode' && <BarcodeSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'staff' && <StaffManagement />}
          {activeTab === 'reports' && <ReportSettings />}
        </div>
      </div>
    </Layout>
  );
}
