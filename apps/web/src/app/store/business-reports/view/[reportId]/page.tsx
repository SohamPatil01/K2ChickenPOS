'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { getReportById } from '@/lib/businessReportsCatalog';
import { FilterSystem, FilterCriteria } from '@/components/FilterSystem';
import { defaultDateRangeLast30Days } from '@/lib/dateRangeParams';
import { downloadStyledReport } from '@/lib/reportExport';

interface Props {
  params: { reportId: string };
}

function formatCurrency(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function flattenForTable(data: unknown, prefix = ''): { key: string; value: string }[] {
  if (data == null) return [];
  if (typeof data !== 'object') return [{ key: prefix, value: String(data) }];
  if (Array.isArray(data)) {
    return data.flatMap((item, i) => flattenForTable(item, `${prefix}[${i}]`));
  }
  return Object.entries(data as Record<string, unknown>).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      return flattenForTable(v, key);
    }
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      return [];
    }
    return [{ key, value: v == null ? '' : String(v) }];
  });
}

function arrayTable(rows: Record<string, unknown>[], title: string) {
  if (!rows?.length) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div key={title} className="overflow-x-auto">
      <h3 className="text-sm font-semibold text-ink mb-2">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 px-2 text-ink-muted font-medium capitalize">
                {h.replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-surface-2">
              {headers.map((h) => (
                <td key={h} className="py-2 px-2 text-ink">
                  {String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && (
        <p className="text-xs text-ink-muted mt-2">Showing first 200 of {rows.length} rows</p>
      )}
    </div>
  );
}

export default function BusinessReportViewPage({ params }: Props) {
  const { reportId } = params;
  const router = useRouter();
  const report = getReportById(reportId);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const defaultRange = defaultDateRangeLast30Days();
  const [filters, setFilters] = useState<FilterCriteria>({
    dateRange: { start: defaultRange.start, end: defaultRange.end },
  });

  const apiPath = report?.apiKey ? `/api/v1/reporting/${report.apiKey}` : null;

  const load = useCallback(async () => {
    if (!apiPath) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(apiPath, {
        params: {
          startDate: filters.dateRange.start,
          endDate: filters.dateRange.end,
        },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [apiPath, filters.dateRange.start, filters.dateRange.end]);

  useEffect(() => {
    if (reportId === 'insights') {
      load();
    } else if (apiPath) {
      load();
    } else {
      setLoading(false);
    }
  }, [reportId, apiPath, load]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    if (data.netSales !== undefined) {
      return [
        { label: 'Net Sales', value: formatCurrency(data.netSales) },
        { label: 'Orders', value: String(data.orderCount ?? '—') },
        { label: 'Net Profit', value: formatCurrency(data.netProfit) },
        { label: 'Margin %', value: data.profitMarginPct != null ? `${data.profitMarginPct}%` : '—' },
      ];
    }
    if (data.summary) {
      const s = data.summary;
      return [
        { label: 'Total Sales', value: formatCurrency(s.totalSales) },
        { label: 'Net Profit', value: formatCurrency(s.netProfit) },
        { label: 'Expenses', value: formatCurrency(s.totalExpenses) },
        { label: 'Margin %', value: s.profitMarginPct != null ? `${s.profitMarginPct}%` : '—' },
      ];
    }
    if (data.revenue) {
      return [
        { label: 'Net Sales', value: formatCurrency(data.revenue.netSales) },
        { label: 'Orders', value: String(data.revenue.orderCount) },
        { label: 'Expenses', value: formatCurrency(data.expenses?.total) },
        { label: 'Net Profit', value: formatCurrency(data.netProfit) },
      ];
    }
    if (data.total != null) {
      return [{ label: 'Total', value: formatCurrency(data.total) }];
    }
    return [];
  }, [data]);

  const tableSections = useMemo(() => {
    if (!data) return [];
    const sections: { title: string; rows: Record<string, unknown>[] }[] = [];
    const arrayKeys = [
      'products',
      'items',
      'employees',
      'customers',
      'categories',
      'budgets',
      'daily',
      'pos',
      'referrers',
      'insights',
      'variances',
      'sales',
    ];
    for (const key of arrayKeys) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        sections.push({ title: key.replace(/([A-Z])/g, ' $1'), rows: data[key] });
      }
    }
    if (data.products && Array.isArray(data.products)) {
      sections.push({ title: 'Products', rows: data.products });
    }
    return sections;
  }, [data]);

  const handleExport = () => {
    if (!report || !data) return;
    const tables = tableSections.map((s) => ({
      title: s.title,
      headers: Object.keys(s.rows[0] || {}),
      rows: s.rows.map((r) => ({
        kind: 'data' as const,
        cells: Object.values(r).map((v) => (v == null ? '' : String(v))),
      })),
    }));
    if (tables.length === 0 && summaryCards.length > 0) {
      tables.push({
        title: 'Summary',
        headers: ['Metric', 'Value'],
        rows: summaryCards.map((c) => ({
          kind: 'data' as const,
          cells: [c.label, c.value],
        })),
      });
    }
    downloadStyledReport({
      title: report.label,
      filename: `${report.id}-report`,
      period: `${filters.dateRange.start} to ${filters.dateRange.end}`,
      summary: summaryCards.map((c) => ({ label: c.label, value: c.value })),
      tables,
    });
  };

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-muted">Report not found.</p>
        <Link href="/store/business-reports" className="text-brand-500 mt-2 inline-block">
          Back to Business Reports
        </Link>
      </div>
    );
  }

  // Special pages
  if (reportId === 'expense-entry') {
    router.replace('/store/business-reports/manage/expenses');
    return null;
  }
  if (reportId === 'budget-management') {
    router.replace('/store/business-reports/manage/budgets');
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/store/business-reports"
            className="flex items-center gap-1 text-sm text-ink-secondary hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Business Reports
          </Link>
          <h1 className="text-xl font-bold text-ink">{report.label}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-2 flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={!data}
            className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 flex items-center gap-1"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <p className="text-sm text-ink-muted mb-4">{report.description}</p>

      {apiPath && (
        <div className="mb-4">
          <FilterSystem
            onFilterChange={setFilters}
            showPaymentMethodFilter={false}
            defaultRange="last30days"
            storageKey={`report_${reportId}`}
          />
        </div>
      )}

      {loading && <p className="text-ink-muted py-8 text-center">Loading...</p>}
      {error && <p className="text-red-500 py-4">{error}</p>}

      {!loading && data && (
        <>
          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {summaryCards.map((c) => (
                <div key={c.label} className="glass-panel rounded-xl p-4">
                  <p className="text-xs text-ink-muted">{c.label}</p>
                  <p className="text-lg font-semibold text-ink">{c.value}</p>
                </div>
              ))}
            </div>
          )}

          {reportId === 'insights' && Array.isArray(data.insights) && (
            <div className="space-y-3 mb-6">
              {data.insights.map((ins: any) => (
                <div
                  key={ins.id}
                  className={`glass-panel rounded-xl p-4 border-l-4 ${
                    ins.severity === 'critical'
                      ? 'border-l-red-500'
                      : ins.severity === 'warning'
                        ? 'border-l-amber-500'
                        : 'border-l-brand-500'
                  }`}
                >
                  <p className="font-medium text-ink">{ins.title}</p>
                  <p className="text-sm text-ink-muted mt-1">{ins.message}</p>
                  {ins.reportPath && (
                    <Link href={ins.reportPath} className="text-xs text-brand-500 mt-2 inline-block">
                      View report →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-6">
            {tableSections.map((s) => arrayTable(s.rows, s.title))}
          </div>

          {tableSections.length === 0 && summaryCards.length === 0 && (
            <pre className="text-xs bg-surface-2 rounded-xl p-4 overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
