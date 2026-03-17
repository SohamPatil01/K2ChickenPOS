'use client';

import Link from 'next/link';
import { getHQConsoleUrl } from '@/lib/hq';

interface DashboardQuickActionsProps {
  pendingPaymentsCount: number;
  userRole: string;
}

export default function DashboardQuickActions({
  pendingPaymentsCount,
  userRole,
}: DashboardQuickActionsProps) {
  const hqHref = getHQConsoleUrl();
  const isExternal = hqHref.startsWith('http');
  const linkClass =
    'flex flex-col items-center justify-center p-3 sm:p-4 bg-brand-50 dark:bg-brand-900/20 rounded-2xl hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 touch-target shadow-sm hover:shadow-md';
  const hqContent = (
    <>
      <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🏢</span>
      <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-brand-400 text-center">HQ Console</span>
    </>
  );

  const actionCardClass =
    'flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl transition-all duration-200 touch-target shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {pendingPaymentsCount > 0 && (
          <Link
            href="/store/pending-payments"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-orange-100 dark:bg-orange-900/30 rounded-2xl hover:bg-orange-200 dark:hover:bg-orange-900/50 border-2 border-orange-300 dark:border-orange-700 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">⏳</span>
            <span className="font-medium text-xs sm:text-sm text-orange-700 dark:text-orange-300 text-center">
              Pending Payments
            </span>
            <span className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
              {pendingPaymentsCount} order(s)
            </span>
          </Link>
        )}
        <Link
          href="/store/pos"
          className={linkClass}
        >
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🛒</span>
          <span className="font-medium text-xs sm:text-sm text-brand-600 dark:text-brand-400 text-center">
            New Sale
          </span>
        </Link>
        <Link
          href="/store/inventory"
          className={`${actionCardClass} bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30`}
        >
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📦</span>
          <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-blue-400 text-center">
            Inventory
          </span>
        </Link>
        <Link
          href="/store/stock-ledger"
          className={`${actionCardClass} bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30`}
        >
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📋</span>
          <span className="font-medium text-xs sm:text-sm text-green-600 dark:text-green-400 text-center">
            Stock Ledger
          </span>
        </Link>
        <Link
          href="/store/reports"
          className={`${actionCardClass} bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30`}
        >
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📈</span>
          <span className="font-medium text-xs sm:text-sm text-purple-600 dark:text-purple-400 text-center">
            Reports
          </span>
        </Link>
      </div>

      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
            Manager Tools
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/store/wastage"
              className={`${actionCardClass} bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30`}
            >
              <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🗑️</span>
              <span className="font-medium text-xs sm:text-sm text-red-600 dark:text-red-400 text-center">
                Wastage Management
              </span>
            </Link>
            <Link
              href="/store/yield"
              className={`${actionCardClass} bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30`}
            >
              <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📊</span>
              <span className="font-medium text-xs sm:text-sm text-orange-600 dark:text-orange-400 text-center">
                Yield Tracking
              </span>
            </Link>
          </div>
        </div>
      )}

      {userRole === 'OWNER' && (
        <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
            Owner Tools
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {isExternal ? (
              <a
                href={hqHref}
                className={`${actionCardClass} bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                onClick={(e) => {
                  if (typeof window !== 'undefined') {
                    const accessToken = localStorage.getItem('accessToken');
                    const refreshToken = localStorage.getItem('refreshToken');
                    if (accessToken) {
                      e.preventDefault();
                      const params = new URLSearchParams({
                        accessToken,
                        refreshToken: refreshToken || '',
                      });
                      window.location.href = `${hqHref}#${params.toString()}`;
                    }
                  }
                }}
              >
                {hqContent}
              </a>
            ) : (
              <Link
                href={hqHref}
                className={`${actionCardClass} bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30`}
              >
                {hqContent}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
