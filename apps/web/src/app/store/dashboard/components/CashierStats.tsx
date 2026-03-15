'use client';

import type { CashierStats as CashierStatsType } from '../hooks/useCashierSales';

interface CashierStatsProps {
  stats: CashierStatsType;
}

export default function CashierStats({ stats }: CashierStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today&apos;s Revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              ₹{stats.todayRevenue.toFixed(2)}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>💰</span>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today&apos;s Sales</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.todayCount}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>📊</span>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Bill</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              ₹{stats.todayAvg.toFixed(2)}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>📈</span>
        </div>
      </div>
    </div>
  );
}
