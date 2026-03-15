'use client';

import Link from 'next/link';
import StatCard from '@/components/StatCard';
import { SkeletonStatCard } from '@/components/ui';
import { formatInrShort } from '@/lib/utils';
import type { DashboardStats } from '../hooks/useDashboardStats';
import AlertsBar from './AlertsBar';

interface DashboardOverviewProps {
  stats: DashboardStats;
  loading: boolean;
  pendingPaymentsTotal: number;
  pendingPaymentsCount: number;
  userRole: string;
}

export default function DashboardOverview({
  stats,
  loading,
  pendingPaymentsTotal,
  pendingPaymentsCount,
  userRole,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl shadow-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                Performance
              </p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1">
                {stats.yesterday.revenue > 0
                  ? `${(((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100).toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
            <span className="text-3xl">
              {stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue
                ? '📈'
                : stats.yesterday.revenue > 0 && stats.today.revenue < stats.yesterday.revenue
                  ? '📉'
                  : '➡️'}
            </span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            {stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue
              ? 'Up from yesterday'
              : stats.yesterday.revenue > 0 && stats.today.revenue < stats.yesterday.revenue
                ? 'Down from yesterday'
                : 'No comparison data'}
          </p>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                Avg Order Value
              </p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100 mt-1">
                ₹{stats.today.avgBill.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <span className="text-3xl">💎</span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            {stats.today.count > 0 ? `${stats.today.count} orders today` : 'No orders yet'}
          </p>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl shadow-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                Monthly Progress
              </p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mt-1">
                {stats.month.count} sales
              </p>
            </div>
            <span className="text-3xl">🎯</span>
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
            ₹{stats.month.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} this month
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {loading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <StatCard
              title="Today's Revenue"
              value={formatInrShort(stats.today.revenue)}
              subtitle={`${stats.today.count} sales today`}
              icon="💰"
              gradient="bg-gradient-to-br from-green-500 to-green-600"
              comparison={{
                label: 'vs yesterday',
                value: stats.yesterday.revenue,
                change:
                  stats.yesterday.revenue > 0
                    ? ((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100
                    : 0,
              }}
            />
            <StatCard
              title="Today's Sales Count"
              value={stats.today.count}
              subtitle={`Avg: ${formatInrShort(stats.today.avgBill)}`}
              icon="📊"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
              comparison={{
                label: 'vs yesterday',
                value: stats.yesterday.count,
                change:
                  stats.yesterday.count > 0
                    ? ((stats.today.count - stats.yesterday.count) / stats.yesterday.count) * 100
                    : 0,
              }}
            />
            <StatCard
              title="Pending Payments"
              value={formatInrShort(pendingPaymentsTotal)}
              subtitle={`${pendingPaymentsCount} pending orders`}
              icon="⏳"
              gradient="bg-gradient-to-br from-orange-500 to-orange-600"
            />
            <StatCard
              title="Monthly Revenue"
              value={formatInrShort(stats.month.revenue)}
              subtitle={`${stats.month.count} total sales`}
              icon="📈"
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
          </>
        )}
      </div>

      <AlertsBar stats={stats} userRole={userRole} />

      {pendingPaymentsCount > 0 && (
        <div className="flex justify-center">
          <Link
            href="/store/pending-payments"
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
          >
            View Pending Payments ({pendingPaymentsCount})
          </Link>
        </div>
      )}
    </div>
  );
}
