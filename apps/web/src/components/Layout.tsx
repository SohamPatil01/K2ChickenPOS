'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { getHQConsoleUrl } from '@/lib/hq';
import { APP_NAME } from '@azela-pos/shared';

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
    <div className="min-h-screen">
      <div className="app-gradient-wash pointer-events-none fixed inset-0 -z-10 print:hidden" aria-hidden />
      <div className="app-glow-layer pointer-events-none fixed inset-0 -z-10 bg-app-glow print:hidden" aria-hidden />
      <nav className="glass-panel-strong sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/store" className="text-xl font-bold text-gradient-brand">
                  {APP_NAME || 'AzeelaAiPos'}
                </Link>
              </div>
              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      pathname === item.path
                        ? 'border-brand-500 text-ink'
                        : 'border-transparent text-ink-secondary hover:text-ink hover:border-border-strong'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {user?.role === 'OWNER' && (() => {
                  const hqHref = getHQConsoleUrl();
                  const isInternalHQ = hqHref === '/hq';
                  const isActive = isInternalHQ && (pathname === '/hq' || pathname?.startsWith('/hq/'));
                  const className = `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-brand-500 text-ink'
                      : 'border-transparent text-ink-secondary hover:text-ink hover:border-border-strong'
                  }`;
                  const handleHQClick = (e: React.MouseEvent) => {
                    if (!isInternalHQ && typeof window !== 'undefined') {
                      const accessToken = localStorage.getItem('accessToken');
                      const refreshToken = localStorage.getItem('refreshToken');
                      if (accessToken) {
                        e.preventDefault();
                        const params = new URLSearchParams({ accessToken, refreshToken: refreshToken || '' });
                        window.location.href = `${hqHref}#${params.toString()}`;
                      }
                    }
                  };
                  return isInternalHQ ? (
                    <Link href={hqHref} className={className}>HQ</Link>
                  ) : (
                    <a href={hqHref} className={className} onClick={handleHQClick}>HQ</a>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center">
              {user ? (
                <>
                  <span className="hidden sm:inline text-sm text-ink-secondary mr-4">
                    {user.name} ({user.role})
                  </span>
                  <span className="sm:hidden text-xs text-ink-secondary mr-2">
                    {user.name}
                  </span>
                  <button
                    onClick={() => {
                      logout();
                      router.push('/login');
                    }}
                    className="text-sm text-ink-muted hover:text-ink px-2 py-1 transition-colors"
                  >
                    Logout
                  </button>
                  {/* Mobile menu button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden ml-2 inline-flex items-center justify-center p-2 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 focus:outline-none transition-colors"
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
                <span className="text-sm text-ink-muted">Guest Mode</span>
              )}
            </div>
          </div>
        </div>
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-subtle">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    pathname === item.path
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {user?.role === 'OWNER' && (() => {
                const hqHref = getHQConsoleUrl();
                const isInternalHQ = hqHref === '/hq';
                const isActive = isInternalHQ && (pathname === '/hq' || pathname?.startsWith('/hq/'));
                const className = `block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'
                }`;
                const handleHQClick = (e: React.MouseEvent) => {
                  setMobileMenuOpen(false);
                  if (!isInternalHQ && typeof window !== 'undefined') {
                    const accessToken = localStorage.getItem('accessToken');
                    const refreshToken = localStorage.getItem('refreshToken');
                    if (accessToken) {
                      e.preventDefault();
                      const params = new URLSearchParams({ accessToken, refreshToken: refreshToken || '' });
                      window.location.href = `${hqHref}#${params.toString()}`;
                    }
                  }
                };
                return isInternalHQ ? (
                  <Link href={hqHref} onClick={() => setMobileMenuOpen(false)} className={className}>HQ</Link>
                ) : (
                  <a href={hqHref} className={className} onClick={handleHQClick}>HQ</a>
                );
              })()}
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
