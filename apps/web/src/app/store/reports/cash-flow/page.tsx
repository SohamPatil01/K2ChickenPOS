'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { SimpleLineChart, SimpleBarChart } from '@/components/charts';
import { FilterSystem, FilterCriteria } from '@/components/FilterSystem';
import { exportToCSV } from '@/lib/exportCSV';
import { format } from 'date-fns';

interface CashFlowData {
  date: string;
  openingBalance: number;
  cashInflows: {
    cashSales: number;
    cardSales: number;
    upiSales: number;
    total: number;
  };
  cashOutflows: {
    expenses: number;
    wastage: number;
    total: number;
  };
  netCashFlow: number;
  closingBalance: number;
}

export default function CashFlowReportPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [filters, setFilters] = useState<FilterCriteria | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (filters) {
      loadCashFlow();
    }
  }, [user, router, filters]);

  const loadCashFlow = async () => {
    if (!filters) return;
    
    try {
      setLoading(true);
      
      // Fetch daily closings for the period
      const closingsResponse = await api.get('/api/v1/daily-closing', {
        params: {
          startDate: filters.dateRange.start,
          endDate: filters.dateRange.end,
        },
      });

      const closings = closingsResponse.data || [];
      
      // Process into cash flow format
      const cashFlow: CashFlowData[] = closings.map((closing: any) => ({
        date: format(new Date(closing.date), 'MMM dd, yyyy'),
        openingBalance: closing.openingCash || 0,
        cashInflows: {
          cashSales: closing.cashSales || 0,
          cardSales: closing.cardSales || 0,
          upiSales: closing.upiSales || 0,
          total: (closing.cashSales || 0) + (closing.cardSales || 0) + (closing.upiSales || 0),
        },
        cashOutflows: {
          expenses: 0, // TODO: Add expenses tracking
          wastage: closing.totalWastageKg || 0,
          total: closing.totalWastageKg || 0,
        },
        netCashFlow: (closing.cashSales || 0) - (closing.totalWastageKg || 0),
        closingBalance: closing.closingCash || 0,
      }));

      setCashFlowData(cashFlow);
    } catch (error) {
      console.error('Failed to load cash flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const data = cashFlowData.map(cf => ({
      'Date': cf.date,
      'Opening Balance': cf.openingBalance.toFixed(2),
      'Cash Sales': cf.cashInflows.cashSales.toFixed(2),
      'Card Sales': cf.cashInflows.cardSales.toFixed(2),
      'UPI Sales': cf.cashInflows.upiSales.toFixed(2),
      'Total Inflows': cf.cashInflows.total.toFixed(2),
      'Expenses': cf.cashOutflows.expenses.toFixed(2),
      'Wastage': cf.cashOutflows.wastage.toFixed(2),
      'Total Outflows': cf.cashOutflows.total.toFixed(2),
      'Net Cash Flow': cf.netCashFlow.toFixed(2),
      'Closing Balance': cf.closingBalance.toFixed(2),
    }));

    exportToCSV({
      filename: `cash-flow-${filters?.dateRange.start}-to-${filters?.dateRange.end}.csv`,
      data,
    });
  };

  const totalInflows = cashFlowData.reduce((sum, cf) => sum + cf.cashInflows.total, 0);
  const totalOutflows = cashFlowData.reduce((sum, cf) => sum + cf.cashOutflows.total, 0);
  const netCashFlow = totalInflows - totalOutflows;

  // Prepare chart data
  const chartData = cashFlowData.map(cf => ({
    name: cf.date,
    inflows: cf.cashInflows.total,
    outflows: cf.cashOutflows.total,
    net: cf.netCashFlow,
  }));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Cash Flow Statement</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Track cash inflows and outflows over time
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={cashFlowData.length === 0}
          className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors font-medium text-sm border border-green-200 dark:border-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📊 Export CSV
        </button>
      </div>

      {/* Filters */}
      <FilterSystem
        onFilterChange={setFilters}
        showPaymentMethodFilter={false}
        showStatusFilter={false}
        storageKey="cashflow_filters"
      />

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-ink-muted">Loading cash flow data...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
              <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Total Inflows</h3>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                ₹{totalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Total Outflows</h3>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                ₹{totalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`bg-gradient-to-br ${netCashFlow >= 0 ? 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800' : 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800'} rounded-lg p-6 border`}>
              <h3 className={`text-sm font-medium ${netCashFlow >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'} mb-2`}>Net Cash Flow</h3>
              <p className={`text-3xl font-bold ${netCashFlow >= 0 ? 'text-blue-900 dark:text-blue-100' : 'text-orange-900 dark:text-orange-100'}`}>
                ₹{netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Charts */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 gap-6">
              <div className="glass-panel rounded-2xl p-6">
                <SimpleLineChart
                  data={chartData}
                  dataKey="net"
                  xAxisKey="name"
                  title="Net Cash Flow Trend"
                  height={300}
                  lineColor="#3b82f6"
                />
              </div>

              <div className="glass-panel rounded-2xl p-6">
                <SimpleBarChart
                  data={chartData}
                  dataKey="inflows"
                  xAxisKey="name"
                  title="Cash Inflows by Day"
                  height={300}
                  barColor="#10b981"
                />
              </div>
            </div>
          )}

          {/* Detailed Table */}
          <div className="glass-panel-strong rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-secondary uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-ink-secondary uppercase">Opening</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-ink-secondary uppercase">Inflows</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-ink-secondary uppercase">Outflows</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-ink-secondary uppercase">Net Flow</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-ink-secondary uppercase">Closing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cashFlowData.map((cf, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-sm text-ink">{cf.date}</td>
                      <td className="px-4 py-3 text-sm text-right text-ink-secondary">
                        ₹{cf.openingBalance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-medium">
                        ₹{cf.cashInflows.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400 font-medium">
                        ₹{cf.cashOutflows.total.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${cf.netCashFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        ₹{cf.netCashFlow.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-ink font-medium">
                        ₹{cf.closingBalance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {cashFlowData.length === 0 && (
            <div className="text-center py-12 glass-panel rounded-2xl">
              <p className="text-ink-muted">No cash flow data available for the selected period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

