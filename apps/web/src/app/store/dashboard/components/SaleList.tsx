'use client';

import type { Sale } from '../hooks/useCashierSales';
import DashboardEmpty from './DashboardEmpty';

interface SaleListProps {
  sales: Sale[];
  onView: (sale: Sale) => void;
  onEdit: (sale: Sale) => void;
}

export default function SaleList({ sales, onView, onEdit }: SaleListProps) {
  if (sales.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">Your Bills Today</h2>
        </div>
        <DashboardEmpty
          message="No sales today"
          actionHref="/store/pos"
          actionLabel="Create First Sale"
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold dark:text-white">Your Bills Today</h2>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sales.map((sale) => (
          <div
            key={sale.id}
            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {sale.saleNo}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {sale.customer?.name || 'Walk-in'} • {new Date(sale.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      sale.status === 'PAID'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : sale.status === 'OPEN'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {sale.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {sale.items.length} items
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₹{sale.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onView(sale)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(sale)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
