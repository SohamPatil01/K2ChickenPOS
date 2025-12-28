'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function SKUWiseSalesPage() {
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
      const response = await api.get('/api/v1/reports/sku-wise-sales', {
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
      ['SKU', 'Product Name', 'PLU', 'Qty (KG)', 'Qty (PCS)', 'Revenue', 'Sales Count', 'Avg Price'],
      ...data.map((item) => [
        item.sku,
        item.productName,
        item.plu,
        item.qtyKg,
        item.qtyPcs,
        item.revenue,
        item.salesCount,
        item.avgPrice,
      ]),
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sku-wise-sales-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const totalRevenue = data.reduce((sum: number, item: any) => sum + item.revenue, 0);

  return (
    <Layout>
      <ReportLayout
        title="SKU Wise Sales Report"
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
                  <div className="text-sm text-gray-600">Total SKUs Sold</div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PLU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty (KG)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty (PCS)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item: any) => (
                    <tr key={item.sku}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.sku}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.productName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.plu}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.qtyKg.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.qtyPcs}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{item.revenue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.salesCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">₹{item.avgPrice.toFixed(2)}</td>
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

