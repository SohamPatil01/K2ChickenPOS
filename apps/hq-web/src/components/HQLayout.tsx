'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import StoreRegionSwitcher from './StoreRegionSwitcher';

interface HQLayoutProps {
  children: React.ReactNode;
  selectedStoreId?: string | null;
  selectedRegion?: string | null;
  onStoreChange?: (storeId: string | null) => void;
  onRegionChange?: (region: string | null) => void;
}

export default function HQLayout({ 
  children, 
  selectedStoreId, 
  selectedRegion, 
  onStoreChange, 
  onRegionChange 
}: HQLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (pathname === '/login') return;

    const checkAuth = () => {
      const timer = setTimeout(() => {
        if (!isAuthenticated() || user?.role !== 'OWNER') {
          window.location.href = '/login';
        }
      }, 100);
      return timer;
    };

    const timer = checkAuth();
    return () => clearTimeout(timer);
  }, [pathname, user, isAuthenticated]);

  // Role-based navigation items
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['OWNER'] },
    { path: '/franchises', label: 'Franchises', icon: '🏪', roles: ['OWNER'] },
    { path: '/procurement', label: 'Procurement', icon: '📥', roles: ['OWNER'] },
    { path: '/products', label: 'Products', icon: '📦', roles: ['OWNER'] },
    { path: '/product-master', label: 'Product Master', icon: '🍗', roles: ['OWNER'] },
    { path: '/pricing', label: 'Pricing', icon: '💰', roles: ['OWNER'] },
    { path: '/royalty', label: 'Royalty', icon: '💵', roles: ['OWNER'] },
    { path: '/sales', label: 'Sales', icon: '📊', roles: ['OWNER'] },
    { path: '/orders', label: 'Orders', icon: '🛒', roles: ['OWNER'] },
    { path: '/inventory', label: 'Inventory', icon: '📦', roles: ['OWNER'] },
    { path: '/compliance', label: 'Compliance', icon: '✅', roles: ['OWNER'] },
    { path: '/payments', label: 'Payments', icon: '💳', roles: ['OWNER'] },
    { path: '/analytics', label: 'Analytics', icon: '📈', roles: ['OWNER'] },
    { path: '/settings', label: 'Settings', icon: '⚙️', roles: ['OWNER'] },
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) => 
    !user || item.roles.includes(user.role as any)
  );

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-primary-600 dark:text-brand-400">AzelaPOS HQ</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {/* Store & Region Switcher */}
        {sidebarOpen && onStoreChange && onRegionChange && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <StoreRegionSwitcher
              selectedStoreId={selectedStoreId || null}
              selectedRegion={selectedRegion || null}
              onStoreChange={onStoreChange}
              onRegionChange={onRegionChange}
            />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {user ? (
            <div className={sidebarOpen ? '' : 'flex justify-center'}>
              <div className={sidebarOpen ? 'mb-2' : 'mb-2 text-center'}>
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {sidebarOpen ? user.name : user.name.charAt(0)}
                </div>
                {sidebarOpen && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">HQ Owner</div>
                )}
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {sidebarOpen ? 'Logout' : '🚪'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {sidebarOpen ? 'Guest Mode' : '👤'}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

