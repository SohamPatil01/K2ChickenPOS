'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
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

  const loadData = async () => {
    setLoading(true);
    try {
      // Article wise is same as product wise
      const response = await api.get('/api/v1/reports/product-wise-sale', {
        params: { startDate, endDate },
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
    loadData();
  };

  const handleExport = () => {
    const csv = [
      ['Article', 'SKU', 'Category', 'Qty (KG)', 'Qty (PCS)', 'Revenue', 'Sales Count'],
      ...data.map((item) => [
        item.productName,
        item.sku,
        item.category,
        item.qtyKg,
        item.qtyPcs,
        item.revenue,
        item.salesCount,
      ]),
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `article-wise-sale-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

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
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                    <tr key={item.productId}>
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

