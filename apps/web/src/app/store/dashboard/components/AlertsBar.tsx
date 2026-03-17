'use client';

import type { DashboardStats } from '../hooks/useDashboardStats';

interface AlertsBarProps {
  stats: DashboardStats;
  userRole: string;
}

export default function AlertsBar({ stats, userRole }: AlertsBarProps) {
  if (userRole !== 'MANAGER' && userRole !== 'OWNER') return null;

  return (
    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 mb-4 sm:mb-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-bold text-orange-900 dark:text-orange-200 mb-2">Alerts & Notifications</h3>
          <div className="space-y-2">
            {stats.todayStock.currentStock < 100 && (
              <div className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                <span className="font-semibold">📦 Low Stock:</span>
                <span>Current stock is {stats.todayStock.currentStock.toFixed(0)} units. Consider restocking.</span>
              </div>
            )}
            {stats.today.revenue < stats.yesterday.revenue * 0.7 && stats.yesterday.revenue > 0 && (
              <div className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                <span className="font-semibold">📉 Revenue Alert:</span>
                <span>Today&apos;s revenue is significantly lower than yesterday.</span>
              </div>
            )}
            {stats.paymentBreakdown.cash > stats.paymentBreakdown.total * 0.8 && stats.paymentBreakdown.total > 1000 && (
              <div className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                <span className="font-semibold">💵 Cash Heavy:</span>
                <span>Over 80% of today&apos;s sales are in cash. Consider daily closing soon.</span>
              </div>
            )}
            {stats.today.count === 0 && new Date().getHours() > 12 && (
              <div className="text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
                <span className="font-semibold">🚨 No Sales:</span>
                <span>No sales recorded today yet. Check system status.</span>
              </div>
            )}
            {stats.today.revenue > 0 && stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue * 1.5 && (
              <div className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
                <span className="font-semibold">🎉 Great Day:</span>
                <span>Revenue is 50% higher than yesterday! Keep it up!</span>
              </div>
            )}
            {stats.today.count === 0 && stats.yesterday.revenue === 0 && stats.lastWeek.revenue === 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className="font-semibold">✓ All Clear:</span>
                <span>No alerts at this time. Everything looks good!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
