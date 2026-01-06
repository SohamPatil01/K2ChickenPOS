'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Don't redirect if on login page
    if (pathname === '/login') return;

    // Only check authentication once when component mounts or pathname changes significantly
    // Don't run on every render to avoid interfering with other pages
    const checkAuth = () => {
      // Give a small delay to allow auth store to initialize from localStorage
      const timer = setTimeout(() => {
        if (!isAuthenticated()) {
          window.location.href = '/login';
        }
      }, 100);
      return timer;
    };

    const timer = checkAuth();
    return () => clearTimeout(timer);
  }, [pathname]); // Only depend on pathname

  const navItems = [
    { path: '/store', label: 'Store', roles: ['MANAGER', 'OWNER', 'DRIVER'] },
    { path: '/hq', label: 'HQ', roles: ['OWNER'] },
  ];

  // Filter nav items based on user role
  // Hide Store tab when on reports, purchase orders, or analytics pages
  const visibleNavItems = navItems.filter((item) => {
    if (!user?.role) return false;
    // Hide Store tab when viewing reports, purchase orders, or analytics (but keep HQ visible)
    if (
      item.path === '/store' &&
      (pathname?.startsWith('/store/reports') ||
      pathname?.startsWith('/reports') ||
      pathname?.startsWith('/po') ||
      pathname?.startsWith('/analytics'))
    ) {
      return false;
    }
    return item.roles.includes(user.role as any);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white shadow-sm border-b dark:bg-gray-800 dark:border-gray-700 dark:shadow-[0px_1px_3px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/store" className="text-xl font-bold text-primary-600 hover:text-primary-700">
                  AzelaPOS
                </Link>
              </div>
              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      pathname === item.path
                        ? 'border-primary-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              {user ? (
                <>
                  <span className="hidden sm:inline text-sm text-gray-700 mr-4">
                    {user.name} ({user.role})
                  </span>
                  <span className="sm:hidden text-xs text-gray-700 mr-2">
                    {user.name}
                  </span>
                  <button
                    onClick={() => {
                      logout();
                      router.push('/login');
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
                  >
                    Logout
                  </button>
                  {/* Mobile menu button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden ml-2 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                    aria-label="Toggle menu"
                  >
                    <svg
                      className="h-6 w-6"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      {mobileMenuOpen ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      )}
                    </svg>
                  </button>
                </>
              ) : (
                <span className="text-sm text-gray-500">Guest Mode</span>
              )}
            </div>
          </div>
        </div>
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname === item.path
                      ? 'bg-primary-50 text-primary-700 dark:bg-brand-900/30 dark:text-brand-400'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}

