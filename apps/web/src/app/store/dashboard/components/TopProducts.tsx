'use client';

import Link from 'next/link';
import type { DashboardStats } from '../hooks/useDashboardStats';

interface TopProductsProps {
  stats: DashboardStats;
  userRole: string;
}

/** Top products card — 7-day list for managers/owners, today's list otherwise. */
export default function TopProducts({ stats, userRole }: TopProductsProps) {
  const isManager = userRole === 'MANAGER' || userRole === 'OWNER';

  if (isManager && stats.topItems.length > 0) {
    return (
      <div className="glass-panel-strong rounded-2xl p-3 sm:p-4 lg:p-6">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-ink">Top Products (Last 7 Days)</h2>
          <Link
            href="/store/reports"
            className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm hover:underline touch-target"
          >
            View All →
          </Link>
        </div>
        <div className="space-y-3">
          {stats.topItems.slice(0, 5).map((item, idx) => (
            <div
              key={`${item.productId ?? 'item'}-${idx}`}
              className="flex justify-between items-center p-3 bg-surface-2/50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-brand-500/15 rounded-lg flex items-center justify-center">
                    <span className="text-lg font-bold text-brand-600 dark:text-brand-400">#{idx + 1}</span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm text-ink">{item.name}</p>
                  <p className="text-xs text-ink-muted">
                    {item.qtyKg > 0 ? `${item.qtyKg.toFixed(2)} kg` : `${item.qtyPcs} pcs`} sold
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink tabular-nums">₹{item.revenue.toFixed(2)}</p>
                <p className="text-xs text-ink-muted">{item.count} sales</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel-strong rounded-2xl p-3 sm:p-4 lg:p-6">
      <h2 className="text-base sm:text-lg font-bold text-ink mb-3 sm:mb-4">Top Products Today</h2>
      <div className="space-y-3">
        {stats.topProducts.length > 0 ? (
          stats.topProducts.map((product, index) => (
            <div
              key={`${product.productId ?? 'product'}-${index}`}
              className="flex items-center justify-between p-3 bg-surface-2/50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-ink-muted">#{index + 1}</span>
                <div>
                  <p className="font-medium text-ink">{product.productName}</p>
                  <p className="text-xs text-ink-muted">{product.qtySold.toFixed(2)} units</p>
                </div>
              </div>
              <p className="font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                ₹{product.revenue.toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <p className="text-ink-muted text-center py-4">No sales today</p>
        )}
      </div>
    </div>
  );
}
