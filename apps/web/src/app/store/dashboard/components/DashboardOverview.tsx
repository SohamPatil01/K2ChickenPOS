'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight, Gem, Target } from 'lucide-react';
import StatCardGlass from '@/components/StatCardGlass';
import { SkeletonStatCard } from '@/components/ui';
import { formatInrShort } from '@/lib/utils';
import { fadeInUp, staggerContainer, useMotionSafe } from '@/lib/motion';
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
  const motionSafe = useMotionSafe();

  const perfUp = stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue;
  const perfDown = stats.yesterday.revenue > 0 && stats.today.revenue < stats.yesterday.revenue;

  return (
    <div className="space-y-6">
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={motionSafe ? staggerContainer(0.06) : undefined}
        initial={motionSafe ? 'hidden' : false}
        animate="show"
      >
        <motion.div
          variants={motionSafe ? fadeInUp : undefined}
          className="glass-panel rounded-2xl p-4 border-blue-500/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-widest">
                Performance
              </p>
              <p className="text-lg font-bold text-ink mt-1 tabular-nums">
                {stats.yesterday.revenue > 0
                  ? `${(((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100).toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              {perfUp ? (
                <TrendingUp className="h-5 w-5" />
              ) : perfDown ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            {perfUp ? 'Up from yesterday' : perfDown ? 'Down from yesterday' : 'No comparison data'}
          </p>
        </motion.div>

        <motion.div
          variants={motionSafe ? fadeInUp : undefined}
          className="glass-panel rounded-2xl p-4 border-green-500/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-600 dark:text-green-300 uppercase tracking-widest">
                Avg Order Value
              </p>
              <p className="text-lg font-bold text-ink mt-1 tabular-nums">
                ₹{stats.today.avgBill.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/15 text-green-600 dark:text-green-400">
              <Gem className="h-5 w-5" />
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            {stats.today.count > 0 ? `${stats.today.count} orders today` : 'No orders yet'}
          </p>
        </motion.div>

        <motion.div
          variants={motionSafe ? fadeInUp : undefined}
          className="glass-panel rounded-2xl p-4 border-purple-500/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-widest">
                Monthly Progress
              </p>
              <p className="text-lg font-bold text-ink mt-1 tabular-nums">{stats.month.count} sales</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Target className="h-5 w-5" />
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            ₹{stats.month.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} this month
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6"
        variants={motionSafe ? staggerContainer(0.05) : undefined}
        initial={motionSafe ? 'hidden' : false}
        animate="show"
      >
        {loading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <motion.div variants={motionSafe ? fadeInUp : undefined}>
              <StatCardGlass
                title="Today's Revenue"
                value={formatInrShort(stats.today.revenue)}
                rawValue={stats.today.revenue}
                format={formatInrShort}
                subtitle={`${stats.today.count} sales today`}
                icon="💰"
                tone="green"
                comparison={{
                  label: 'vs yesterday',
                  value: stats.yesterday.revenue,
                  change:
                    stats.yesterday.revenue > 0
                      ? ((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100
                      : 0,
                }}
              />
            </motion.div>
            <motion.div variants={motionSafe ? fadeInUp : undefined}>
              <StatCardGlass
                title="Today's Sales Count"
                value={stats.today.count}
                rawValue={stats.today.count}
                subtitle={`Avg: ${formatInrShort(stats.today.avgBill)}`}
                icon="📊"
                tone="blue"
                comparison={{
                  label: 'vs yesterday',
                  value: stats.yesterday.count,
                  change:
                    stats.yesterday.count > 0
                      ? ((stats.today.count - stats.yesterday.count) / stats.yesterday.count) * 100
                      : 0,
                }}
              />
            </motion.div>
            <motion.div variants={motionSafe ? fadeInUp : undefined}>
              <StatCardGlass
                title="Pending Payments"
                value={formatInrShort(pendingPaymentsTotal)}
                rawValue={pendingPaymentsTotal}
                format={formatInrShort}
                subtitle={`${pendingPaymentsCount} pending orders`}
                icon="⏳"
                tone="orange"
              />
            </motion.div>
            <motion.div variants={motionSafe ? fadeInUp : undefined}>
              <StatCardGlass
                title="Monthly Revenue"
                value={formatInrShort(stats.month.revenue)}
                rawValue={stats.month.revenue}
                format={formatInrShort}
                subtitle={`${stats.month.count} total sales`}
                icon="📈"
                tone="purple"
              />
            </motion.div>
          </>
        )}
      </motion.div>

      <AlertsBar stats={stats} userRole={userRole} />

      {pendingPaymentsCount > 0 && (
        <div className="flex justify-center">
          <Link
            href="/store/pending-payments"
            className="px-6 py-3 bg-gradient-brand text-white rounded-2xl font-medium shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-105 transition-all active:scale-95"
          >
            View Pending Payments ({pendingPaymentsCount})
          </Link>
        </div>
      )}
    </div>
  );
}
