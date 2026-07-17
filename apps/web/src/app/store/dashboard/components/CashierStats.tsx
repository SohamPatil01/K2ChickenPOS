'use client';

import type { CashierStats as CashierStatsType } from '../hooks/useCashierSales';

interface CashierStatsProps {
  stats: CashierStatsType;
}

export default function CashierStats({ stats }: CashierStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-secondary">Today&apos;s Revenue</p>
            <p className="text-2xl font-bold text-ink mt-1">
              ₹{stats.todayRevenue.toFixed(2)}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>💰</span>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-secondary">Today&apos;s Sales</p>
            <p className="text-2xl font-bold text-ink mt-1">
              {stats.todayCount}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>📊</span>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-secondary">Average Bill</p>
            <p className="text-2xl font-bold text-ink mt-1">
              ₹{stats.todayAvg.toFixed(2)}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>📈</span>
        </div>
      </div>
    </div>
  );
}
