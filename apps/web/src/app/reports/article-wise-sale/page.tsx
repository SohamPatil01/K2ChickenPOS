'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { MasaleTypeBadge, ReportMasaleSummary } from '@/components/ReportMasaleSummary';
import { useState, useEffect } from 'react';
import {
  downloadReportTable,
  formatCurrency,
  formatReportPeriod,
} from '@/lib/reportExport';
import { masaleSplitFromRows } from '@azela-pos/shared';
import api from '@/lib/api';

export default function ArticleWiseSalePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const effectiveStartDate = start !== undefined ? start : startDate;
      const effectiveEndDate = end !== undefined ? end : endDate;
      // Article wise is same as product wise
      const response = await api.get('/api/v1/reports/product-wise-sale', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });
      setData(response.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    // Use the new dates directly instead of state
    loadData(start, end);
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const masaleSplit = masaleSplitFromRows(
    data.map((item) => ({
      isMasale: item.isMasale,
      revenue: item.revenue,
      qtyKg: item.qtyKg,
      qtyPcs: item.qtyPcs,
      lineCount: item.salesCount,
    }))
  );

  const handleExport = () => {
    downloadReportTable('Article Wise Sale Report', `article-wise-sale-${startDate}-to-${endDate}`, {
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Total Articles', value: String(data.length) },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
        { label: 'Masale Revenue', value: formatCurrency(masaleSplit.masaleRevenue) },
        { label: 'Masale Qty (PCS)', value: String(masaleSplit.masaleQtyPcs) },
      ],
      headers: ['Type', 'Article', 'SKU', 'Category', 'Qty (KG)', 'Qty (PCS)', 'Revenue', 'Sales Count'],
      columnAlign: ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right'],
      rows: data.map((item) => ({
        kind: 'data' as const,
        cells: [
          item.isMasale ? 'Masale' : 'Chicken',
          item.productName,
          item.sku,
          item.category,
          item.qtyKg.toFixed(2),
          item.qtyPcs,
          formatCurrency(item.revenue),
          item.salesCount,
        ],
      })),
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Artical Wise Sale Report"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No sales data available.</div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Articles</div>
                  <div className="text-2xl font-bold">{data.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
                </div>
              </div>
              <ReportMasaleSummary
                masaleRevenue={masaleSplit.masaleRevenue}
                masaleQtyPcs={masaleSplit.masaleQtyPcs}
                otherRevenue={masaleSplit.otherRevenue}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty (KG)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty (PCS)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item) => (
                    <tr key={item.productId} className={item.isMasale ? 'bg-brand-50/30' : ''}>
                      <td className="px-6 py-4 text-sm"><MasaleTypeBadge isMasale={item.isMasale} /></td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.productName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.sku}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.qtyKg.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.qtyPcs}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{item.revenue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.salesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}

