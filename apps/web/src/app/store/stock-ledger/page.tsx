'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { defaultDateRangeLast30Days, localDateRangeToApiBounds } from '@/lib/dateRangeParams';

interface StockLedgerEntry {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  type: 'IN' | 'OUT';
  reason: string;
  qtyKg?: number;
  qtyPcs?: number;
  refId?: string;
  createdAt: string;
}

export default function StockLedgerPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultRange = defaultDateRangeLast30Days();
  const [filters, setFilters] = useState({
    startDate: defaultRange.start,
    endDate: defaultRange.end,
    type: '',
    reason: '',
    productId: '',
  });
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // Load products only once
    if (!productsLoaded) {
      loadProducts();
    }
  }, [user, router, productsLoaded]);

  // Separate effect for ledger that debounces filter changes
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        loadLedger();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filters, user]);

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/v1/products');
      setProducts(response.data || []);
      setProductsLoaded(true);
    } catch (error: any) {
      console.error('Failed to load products:', error);
    }
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      const bounds = localDateRangeToApiBounds(filters.startDate, filters.endDate);
      const params: any = {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      };
      if (filters.type) params.type = filters.type;
      if (filters.reason) params.reason = filters.reason;
      if (filters.productId) params.productId = filters.productId;

      const response = await api.get('/api/v1/inventory/ledger', { params });
      setEntries(response.data || []);
    } catch (error: any) {
      console.error('Failed to load stock ledger:', error);
      alert(error.response?.data?.error || 'Failed to load stock ledger');
    } finally {
      setLoading(false);
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      OPENING: 'Opening Stock',
      RECEIVE: 'Received from HQ',
      SALE: 'Sale',
      WASTAGE: 'Wastage',
      ADJUSTMENT: 'Adjustment',
      RETURN: 'Return',
    };
    return labels[reason] || reason;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-muted">Loading stock ledger...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      <div className="mb-3 sm:mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink">Stock Ledger</h1>
        <p className="text-xs sm:text-sm text-ink-muted mt-1">Track all inventory movements</p>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
            >
              <option value="">All Types</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">Reason</label>
            <select
              value={filters.reason}
              onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
            >
              <option value="">All Reasons</option>
              <option value="OPENING">Opening Stock</option>
              <option value="RECEIVE">Received from HQ</option>
              <option value="SALE">Sale</option>
              <option value="WASTAGE">Wastage</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">Product</label>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 min-h-0 flex flex-col glass-panel-strong rounded-2xl overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-auto -mx-3 sm:mx-0 min-h-0">
          <div className="inline-block min-w-full align-middle">
            <table className="table-glass min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-surface-2/80 backdrop-blur-sm">
                <tr>
                  <th className="px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-2 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                    Reason
                  </th>
                  <th className="px-2 sm:px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Qty (Kg)
                  </th>
                  <th className="px-2 sm:px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Qty (Pcs)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {entries.length > 0 ? (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-brand-100/30 dark:hover:bg-brand-900/10">
                      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-ink">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-ink">{entry.product.name}</div>
                        <div className="text-xs sm:text-sm text-ink-muted">SKU: {entry.product.sku}</div>
                        <div className="text-xs text-ink-muted md:hidden mt-1">{getReasonLabel(entry.reason)}</div>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ entry.type === 'IN' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-ink hidden md:table-cell">
                        {getReasonLabel(entry.reason)}
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-ink">
                        {entry.qtyKg ? entry.qtyKg.toFixed(2) : '-'}
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-ink">
                        {entry.qtyPcs || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-xs sm:text-sm text-ink-muted">
                      No ledger entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

