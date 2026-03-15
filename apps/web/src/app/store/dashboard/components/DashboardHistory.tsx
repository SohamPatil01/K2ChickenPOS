'use client';

import type { HistoricalData } from '../hooks/useDashboardStats';

interface DashboardHistoryProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onLoad: () => void;
  loading: boolean;
  historicalData: HistoricalData | null;
  userRole: string;
}

export default function DashboardHistory({
  selectedDate,
  onDateChange,
  onLoad,
  loading,
  historicalData,
  userRole,
}: DashboardHistoryProps) {
  if (userRole !== 'MANAGER' && userRole !== 'OWNER') return null;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <span className="text-2xl">📅</span>
          Historical Data
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:[color-scheme:dark]"
          />
          <button
            onClick={onLoad}
            disabled={loading}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>

      {historicalData && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-semibold">Total Sales</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                {historicalData.salesCount}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                ₹{Math.round(historicalData.totalRevenue).toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4">
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-1 font-semibold">Pending</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                {historicalData.pendingCount}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                ₹{Math.round(historicalData.pendingAmount).toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4 col-span-2 md:col-span-1">
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 font-semibold">Date</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-300">
                {new Date(historicalData.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Cash</p>
              <p className="text-xl font-bold text-green-900 dark:text-green-300">
                ₹{Math.round(historicalData.paymentBreakdown.cash).toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">UPI</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-300">
                ₹{Math.round(historicalData.paymentBreakdown.upi).toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Card</p>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-300">
                ₹{Math.round(historicalData.paymentBreakdown.card).toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Other</p>
              <p className="text-xl font-bold text-orange-900 dark:text-orange-300">
                ₹{Math.round(historicalData.paymentBreakdown.other).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {!historicalData && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Select a date and click Load to view historical data
        </div>
      )}
    </div>
  );
}
