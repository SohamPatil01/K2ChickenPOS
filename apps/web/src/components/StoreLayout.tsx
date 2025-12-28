'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import api from '@/lib/api';
import GlobalBarcodeScanner from './GlobalBarcodeScanner';
import Notification from './Notification';

interface StoreLayoutProps {
  children: React.ReactNode;
}

export default function StoreLayout({ children }: StoreLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { notifications, removeNotification } = useNotificationStore();
  const [isOffline, setIsOffline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Check online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    logout();
    router.push('/login');
  };

  const menuSections = [
    {
      title: 'Main',
      items: [
        {
          label: 'Dashboard',
          href: '/store',
          icon: '📊',
          roles: ['CASHIER', 'MANAGER', 'DRIVER', 'OWNER'],
        },
        {
          label: 'POS',
          href: '/store/pos',
          icon: '🛒',
          roles: ['CASHIER', 'MANAGER', 'OWNER'],
        },
        {
          label: 'Cart',
          href: '/store/cart',
          icon: '🛒',
          roles: ['CASHIER', 'MANAGER', 'OWNER'],
        },
        {
          label: 'Customers',
          href: '/store/customers',
          icon: '👥',
          roles: ['CASHIER', 'MANAGER', 'OWNER'],
        },
      ],
    },
    {
      title: 'Inventory',
      items: [
        {
          label: 'Inventory',
          href: '/store/inventory',
          icon: '📦',
          roles: ['MANAGER', 'OWNER'],
        },
        {
          label: 'Stock Ledger',
          href: '/store/stock-ledger',
          icon: '📋',
          roles: ['MANAGER', 'OWNER'],
        },
        {
          label: 'Wastage',
          href: '/store/wastage',
          icon: '🗑️',
          roles: ['MANAGER', 'OWNER'],
        },
        {
          label: 'Yield Tracking',
          href: '/store/yield',
          icon: '📊',
          roles: ['MANAGER', 'OWNER'],
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          label: 'Delivery',
          href: '/store/delivery',
          icon: '🚚',
          roles: ['CASHIER', 'MANAGER', 'DRIVER', 'OWNER'],
        },
        {
          label: 'Daily Closing',
          href: '/store/daily-closing',
          icon: '💰',
          roles: ['CASHIER', 'MANAGER', 'OWNER'],
        },
        {
          label: 'Discount Approvals',
          href: '/store/discount-approvals',
          icon: '✅',
          roles: ['MANAGER', 'OWNER'],
        },
        {
          label: 'Purchase Orders',
          href: '/po',
          icon: '📋',
          roles: ['MANAGER', 'OWNER'],
        },
      ],
    },
    {
      title: 'Reports & Settings',
      items: [
        {
          label: 'Reports',
          href: '/store/reports',
          icon: '📈',
          roles: ['MANAGER', 'OWNER'],
        },
        {
          label: 'Analytics',
          href: '/analytics',
          icon: '📊',
          roles: ['OWNER'],
        },
        {
          label: 'Settings',
          href: '/store/settings',
          icon: '⚙️',
          roles: ['CASHIER', 'MANAGER', 'OWNER'],
        },
      ],
    },
  ];

  // Filter items by role and sections that have visible items
  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => user?.role && item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Global Barcode Scanner */}
      <GlobalBarcodeScanner />
      
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          {notifications.map((notification) => (
            <div key={notification.id} className="pointer-events-auto">
              <Notification
                message={notification.message}
                type={notification.type}
                duration={notification.duration}
                onClose={() => removeNotification(notification.id)}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Brand */}
            <div className="flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/store" className="ml-2 lg:ml-0 flex items-center">
                <span className="text-xl font-bold text-brand-600 dark:text-brand-400">AzelaPOS</span>
              </Link>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4">
              {/* Offline Indicator */}
              {isOffline && (
                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded-md text-sm">
                  <span>🔴</span>
                  <span>Offline Mode</span>
                </div>
              )}

              {/* User Info */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar Menu */}
        <aside
          className={`${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out lg:transition-none`}
        >
          <div className="h-full overflow-y-auto py-4">
            <nav className="space-y-6 px-3">
              {visibleSections.map((section, sectionIndex) => (
                <div key={section.title}>
                  <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      // For Dashboard (/store), only match exact path, not child routes
                      // For other routes, match exact path or child routes
                      const isActive = item.href === '/store' 
                        ? pathname === item.href
                        : pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-l-4 border-brand-500'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className="text-lg">{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile menu */}
        {isMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden min-h-0">
          <div className="h-full p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

