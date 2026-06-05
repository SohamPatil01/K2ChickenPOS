'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { MasaleTypeBadge, ReportMasaleSummary } from '@/components/ReportMasaleSummary';
import { useState, useEffect, Fragment } from 'react';
import { defaultDateRangeLast7Days } from '@/lib/dateRangeParams';
import {
  downloadReportTable,
  formatCurrency,
  formatDisplayDate,
  formatReportPeriod,
  type ExportRow,
} from '@/lib/reportExport';
import { masaleSplitFromRows } from '@azela-pos/shared';
import api from '@/lib/api';

interface DailyProductRow {
  date: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unitType: string;
  isMasale?: boolean;
  qtyKg: number;
  qtyPcs: number;
  revenue: number;
  lineCount: number;
}

interface ReportPayload {
  period: { startDate: string; endDate: string };
  summary: {
    totalRevenue: number;
    totalQtyKg: number;
    totalQtyPcs: number;
    productDayCount: number;
    daysCount: number;
    masaleRevenue?: number;
    masaleQtyKg?: number;
    masaleQtyPcs?: number;
    masaleLineCount?: number;
    otherRevenue?: number;
  };
  masaleByDate?: Record<string, { revenue: number; qtyKg: number; qtyPcs: number; lineCount: number }>;
  rows: DailyProductRow[];
}

export default function DailyProductTransactionPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportPayload | null>(null);
  const defaultRange = defaultDateRangeLast7Days();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const effectiveStartDate = start !== undefined ? start : startDate;
      const effectiveEndDate = end !== undefined ? end : endDate;

      const response = await api.get('/api/v1/reports/daily-product-transaction', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });

      setData(response.data || null);
    } catch (error: any) {
      console.error('Failed to load daily product transaction report:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    loadData(start, end);
  };

  const rows = data?.rows || [];
  const masaleByDate = data?.masaleByDate || {};
  const masaleSplit = masaleSplitFromRows(rows);

  const handleExport = () => {
    if (!data) return;
    const exportRows: ExportRow[] = [];
    let lastDate = '';
    for (const item of rows) {
      if (item.date !== lastDate) {
        lastDate = item.date;
        exportRows.push({ kind: 'section', label: formatDisplayDate(item.date) });
      }
      exportRows.push({
        kind: 'data',
        cells: [
          item.date,
          item.isMasale ? 'Masale' : 'Chicken',
          item.productName,
          item.sku,
          item.category,
          item.qtyKg > 0 ? item.qtyKg.toFixed(2) : '—',
          item.qtyPcs > 0 ? item.qtyPcs : '—',
          formatCurrency(item.revenue),
          item.lineCount,
        ],
      });
    }

    const datesWithMasale = [...new Set(rows.filter((r) => r.isMasale).map((r) => r.date))];
    for (const date of datesWithMasale) {
      const dayMasale = masaleByDate[date];
      if (!dayMasale) continue;
      exportRows.push({
        kind: 'data',
        bold: true,
        cells: [
          date,
          'Masale total',
          '',
          '',
          '',
          dayMasale.qtyKg > 0 ? dayMasale.qtyKg.toFixed(2) : '—',
          dayMasale.qtyPcs > 0 ? dayMasale.qtyPcs : '—',
          formatCurrency(dayMasale.revenue),
          dayMasale.lineCount,
        ],
      });
    }

    downloadReportTable(
      'Daily Product Transaction Report',
      `daily-product-transaction-${startDate}-to-${endDate}`,
      {
        period: formatReportPeriod(startDate, endDate),
        summary: [
          { label: 'Days with sales', value: String(data.summary.daysCount) },
          { label: 'Total Revenue', value: formatCurrency(data.summary.totalRevenue) },
          { label: 'Masale Revenue', value: formatCurrency(data.summary.masaleRevenue ?? masaleSplit.masaleRevenue) },
          {
            label: 'Masale Qty (PCS)',
            value: String(data.summary.masaleQtyPcs ?? masaleSplit.masaleQtyPcs),
          },
          {
            label: 'Chicken / Other Revenue',
            value: formatCurrency(data.summary.otherRevenue ?? masaleSplit.otherRevenue),
          },
        ],
        headers: ['Date', 'Type', 'Product', 'SKU', 'Category', 'Qty (KG)', 'Qty (PCS)', 'Revenue', 'Lines'],
        columnAlign: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right'],
        rows: exportRows,
      }
    );
  };

  const formatDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  let lastDate = '';

  return (
    <Layout>
      <ReportLayout
        title="Daily Product Transaction Report"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading data...</div>
        ) : !data || rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No transaction data for the selected period.
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Days with sales</div>
                  <div className="text-2xl font-bold dark:text-white">{data.summary.daysCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Product-day rows</div>
                  <div className="text-2xl font-bold dark:text-white">{data.summary.productDayCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Qty (KG / PCS)</div>
                  <div className="text-lg font-bold dark:text-white">
                    {data.summary.totalQtyKg.toFixed(2)} / {data.summary.totalQtyPcs}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
                  <div className="text-2xl font-bold dark:text-white">
                    ₹{data.summary.totalRevenue.toFixed(2)}
                  </div>
                </div>
              </div>
              <ReportMasaleSummary
                masaleRevenue={data.summary.masaleRevenue ?? masaleSplit.masaleRevenue}
                masaleQtyPcs={data.summary.masaleQtyPcs ?? masaleSplit.masaleQtyPcs}
                masaleQtyKg={data.summary.masaleQtyKg ?? masaleSplit.masaleQtyKg}
                masaleLineCount={data.summary.masaleLineCount ?? masaleSplit.masaleLineCount}
                otherRevenue={data.summary.otherRevenue ?? masaleSplit.otherRevenue}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Qty (KG)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Qty (PCS)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Lines
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((item, idx) => {
                    const showDateHeader = item.date !== lastDate;
                    const nextRow = rows[idx + 1];
                    const isLastRowForDate = !nextRow || nextRow.date !== item.date;
                    const dayMasale = masaleByDate[item.date];
                    if (showDateHeader) lastDate = item.date;

                    return (
                      <Fragment key={`${item.date}-${item.productId}`}>
                        {showDateHeader && (
                          <tr className="bg-brand-50/60 dark:bg-brand-900/20">
                            <td
                              colSpan={9}
                              className="px-4 py-2 text-sm font-semibold text-brand-800 dark:text-brand-200"
                            >
                              {formatDate(item.date)}
                            </td>
                          </tr>
                        )}
                        <tr
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${item.isMasale ? 'bg-brand-50/20 dark:bg-brand-900/10' : ''}`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.date}</td>
                          <td className="px-4 py-3 text-sm">
                            <MasaleTypeBadge isMasale={item.isMasale} />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {item.qtyKg > 0 ? item.qtyKg.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {item.qtyPcs > 0 ? item.qtyPcs : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            ₹{item.revenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                            {item.lineCount}
                          </td>
                        </tr>
                        {isLastRowForDate && dayMasale && dayMasale.revenue > 0 && (
                          <tr className="bg-brand-100/50 dark:bg-brand-900/30">
                            <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-brand-800 dark:text-brand-200">
                              Masale total — {formatDate(item.date)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-brand-800 dark:text-brand-200">
                              {dayMasale.qtyKg > 0 ? dayMasale.qtyKg.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-brand-800 dark:text-brand-200">
                              {dayMasale.qtyPcs > 0 ? dayMasale.qtyPcs : '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-bold text-brand-800 dark:text-brand-200">
                              ₹{dayMasale.revenue.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-brand-800 dark:text-brand-200">
                              {dayMasale.lineCount}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}
