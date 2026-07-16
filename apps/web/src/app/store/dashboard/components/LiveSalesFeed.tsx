'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatInr, cn } from '@/lib/utils';
import type { DashboardStats } from '../hooks/useDashboardStats';

interface LiveSalesFeedProps {
  sales: DashboardStats['recentSales'];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Recent sales that update live: the dashboard already light-refreshes
 * on `sale-created`/`sale-updated` events, so new rows appear here and
 * slide in with a brief brand glow. No extra data plumbing.
 */
export default function LiveSalesFeed({ sales }: LiveSalesFeedProps) {
  const shown = sales.slice(0, 8);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  // Re-render every 30s so the relative timestamps stay honest
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const seen = seenIdsRef.current;
    const isFirstLoad = seen.size === 0;
    const fresh = new Set<string>();
    for (const s of shown) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        if (!isFirstLoad) fresh.add(s.id);
      }
    }
    if (fresh.size > 0) {
      setFreshIds(fresh);
      const id = window.setTimeout(() => setFreshIds(new Set()), 2500);
      return () => window.clearTimeout(id);
    }
  }, [shown]);

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2.5">
          Live sales
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            LIVE
          </span>
        </h2>
        <Link
          href="/store/orders"
          className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm hover:underline touch-target"
        >
          All orders →
        </Link>
      </div>

      <div className="space-y-2 flex-1">
        {shown.length === 0 ? (
          <p className="text-ink-muted text-center py-8 text-sm">
            No sales yet — new bills appear here the moment they happen.
          </p>
        ) : (
          shown.map((sale) => (
            <div
              key={sale.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-surface-2/50 transition-all duration-500',
                freshIds.has(sale.id) &&
                  'animate-fade-in-up ring-1 ring-brand-500/50 shadow-glow-brand bg-brand-100/40 dark:bg-brand-900/20'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-ink truncate">
                  {sale.customerName || 'Walk-in'}
                </p>
                <p className="text-xs text-ink-muted truncate">
                  {sale.saleNo} · {sale.itemCount ?? 0} items · {timeAgo(sale.createdAt)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-sm text-ink tabular-nums">
                  {formatInr(sale.grandTotal)}
                </p>
                <Badge variant={sale.status === 'PAID' ? 'success' : 'warning'}>
                  {sale.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
