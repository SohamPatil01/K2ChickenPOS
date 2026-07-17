'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import StatCard from '@/components/StatCard';
import { SimpleBarChart } from '@/components/charts';
import { format } from 'date-fns';

const CRORE = 1_00_00_000;

type TaxMethod = 'NORMAL' | '44AD';

interface Summary {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  profit: number;
  presumptiveIncome: number;
  monthlyBreakdown?: Array<{ month: string; sales: number; expenses: number }>;
}

interface CalculateResult extends Summary {
  method: TaxMethod;
  taxableIncome: number;
  taxAmount: number;
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

/** FY preset: Apr 1 current year - Mar 31 next year, or previous FY */
function getFYRange(fyOffset: number): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const apr = now.getMonth() < 3 ? year - 1 : year;
  const start = new Date(apr + fyOffset, 3, 1); // Apr 1
  const end = new Date(apr + fyOffset + 1, 2, 31); // Mar 31
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export default function StoreITRPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [calcResult, setCalcResult] = useState<CalculateResult | null>(null);
  const [dateRange, setDateRange] = useState(() => getFYRange(0));
  const [method, setMethod] = useState<TaxMethod>('NORMAL');

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Summary>('/api/v1/itr/summary', {
        params: { startDate: dateRange.start, endDate: dateRange.end },
      });
      setSummary(res.data ?? null);
      setCalcResult(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load summary');
      setSummary(null);
      setCalcResult(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
      return;
    }
    loadSummary();
  }, [user, router, loadSummary]);

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      setError(null);
      const res = await api.post<CalculateResult>('/api/v1/itr/calculate', { method }, {
        params: { startDate: dateRange.start, endDate: dateRange.end },
      });
      setCalcResult(res.data ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to calculate tax');
      setCalcResult(null);
    } finally {
      setCalculating(false);
    }
  };

  const saveReportJSON = () => {
    const payload = calcResult
      ? { ...calcResult, generatedAt: new Date().toISOString() }
      : summary
        ? { ...summary, generatedAt: new Date().toISOString() }
        : null;
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itr-report-${dateRange.start}-${dateRange.end}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const content = calcResult
      ? `ITR Summary (${dateRange.start} to ${dateRange.end})\nMethod: ${calcResult.method}\nTotal Sales: ${formatINR(calcResult.totalSales)}\nTotal Purchases: ${formatINR(calcResult.totalPurchases)}\nTotal Expenses: ${formatINR(calcResult.totalExpenses)}\nNet Profit: ${formatINR(calcResult.profit)}\nTaxable Income: ${formatINR(calcResult.taxableIncome)}\nEstimated Tax: ${formatINR(calcResult.taxAmount)}\nGenerated: ${new Date().toISOString()}`
      : summary
        ? `ITR Summary (${dateRange.start} to ${dateRange.end})\nTotal Sales: ${formatINR(summary.totalSales)}\nTotal Purchases: ${formatINR(summary.totalPurchases)}\nTotal Expenses: ${formatINR(summary.totalExpenses)}\nNet Profit: ${formatINR(summary.profit)}\nPresumptive (6%): ${formatINR(summary.presumptiveIncome)}\nGenerated: ${new Date().toISOString()}`
        : '';
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <pre style="font-family: sans-serif; padding: 24px;">${content.replace(/</g, '&lt;')}</pre>
      <p style="font-size: 12px; color: #666;">This report is not stored in the system. For official records, use your CA or tax portal.</p>
    `);
    w.document.close();
    w.print();
    w.close();
  };

  if (!user) return null;

  const turnoverExceeds1Cr = (summary?.totalSales ?? 0) >= CRORE;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="bg-brand-500 dark:bg-brand-600 text-white py-3 sm:py-4 px-4 sm:px-6 shadow-md rounded-t-lg">
        <h1 className="text-xl sm:text-2xl font-bold text-white">ITR / Tax</h1>
        <p className="text-white/90 text-sm mt-1">Income tax summary and estimated tax (no data stored)</p>
      </div>

      {/* FY / Date filter */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-secondary mb-1">Start date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-ink px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-secondary mb-1">End date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-ink px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={() => setDateRange(getFYRange(0))}
          className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm"
        >
          Current FY
        </button>
        <button
          type="button"
          onClick={() => setDateRange(getFYRange(-1))}
          className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm"
        >
          Previous FY
        </button>
        <button
          type="button"
          onClick={loadSummary}
          disabled={loading}
          className="px-4 py-2 rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Sales" value={formatINR(summary.totalSales)} icon="💰" />
            <StatCard title="Total Purchases" value={formatINR(summary.totalPurchases)} icon="📦" />
            <StatCard title="Total Expenses" value={formatINR(summary.totalExpenses)} icon="📉" />
            <StatCard title="Net Profit" value={formatINR(summary.profit)} icon="📈" />
          </div>

          {summary.monthlyBreakdown && summary.monthlyBreakdown.length > 0 && (
            <div className="glass-panel rounded-2xl p-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Monthly Sales</h2>
              <SimpleBarChart
                data={summary.monthlyBreakdown.map((m) => ({ name: m.month, value: m.sales }))}
                dataKey="value"
                xAxisKey="name"
                title=""
                height={280}
              />
            </div>
          )}

          {/* Tax method and calculate */}
          <div className="glass-panel rounded-2xl p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Tax calculation</h2>
            <div className="flex flex-wrap gap-4 items-center">
              <span className="text-sm font-medium text-ink-secondary">Method:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  checked={method === 'NORMAL'}
                  onChange={() => setMethod('NORMAL')}
                  className="rounded-full"
                />
                <span className="text-gray-800 dark:text-gray-200">Normal (on profit)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  checked={method === '44AD'}
                  onChange={() => setMethod('44AD')}
                  className="rounded-full"
                />
                <span className="text-gray-800 dark:text-gray-200">Presumptive (44AD)</span>
              </label>
            </div>
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating}
              className="px-4 py-2 rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {calculating ? 'Calculating…' : 'Calculate Tax'}
            </button>

            {calcResult && (
              <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-2">
                <p><strong>Taxable income:</strong> {formatINR(calcResult.taxableIncome)}</p>
                <p><strong>Estimated tax:</strong> {formatINR(calcResult.taxAmount)}</p>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {turnoverExceeds1Cr && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                Audit may be required if turnover exceeds ₹1 Cr. Consult your CA.
              </div>
            )}
            <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-sm">
              44AD may be beneficial for small businesses (presumptive 6% of turnover).
            </div>
          </div>

          {/* Client-side export */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveReportJSON}
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-ink-secondary hover:bg-brand-100/30 dark:hover:bg-brand-900/10"
            >
              Save report (JSON)
            </button>
            <button
              type="button"
              onClick={exportPDF}
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-ink-secondary hover:bg-brand-100/30 dark:hover:bg-brand-900/10"
            >
              Export / Print
            </button>
            <p className="text-xs text-ink-muted self-center">
              Reports are not stored in the system. Use for reference only.
            </p>
          </div>
        </>
      ) : !loading && !error && !summary ? (
        <div className="p-6 rounded-lg bg-gray-50 dark:bg-gray-800 text-ink-secondary text-center">
          No data for the selected period. Adjust dates and refresh.
        </div>
      ) : null}
    </div>
  );
}
