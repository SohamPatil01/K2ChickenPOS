'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import {
  downloadReportTable,
  formatCurrency,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function RangeMasterPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Range Master shows price ranges for products
      const response = await api.get('/api/v1/products');
      const products = response.data || [];
      
      // Group by category and show price ranges
      const categoryRanges: Record<string, { min: number; max: number; products: any[] }> = {};
      
      products.forEach((product: any) => {
        if (!categoryRanges[product.categoryName]) {
          categoryRanges[product.categoryName] = {
            min: product.pricePerUnit,
            max: product.pricePerUnit,
            products: [],
          };
        }
        categoryRanges[product.categoryName].products.push(product);
        categoryRanges[product.categoryName].min = Math.min(
          categoryRanges[product.categoryName].min,
          product.pricePerUnit
        );
        categoryRanges[product.categoryName].max = Math.max(
          categoryRanges[product.categoryName].max,
          product.pricePerUnit
        );
      });

      setData(Object.entries(categoryRanges).map(([category, range]: [string, any]) => ({
        category,
        minPrice: range.min,
        maxPrice: range.max,
        productCount: range.products.length,
        products: range.products,
      })));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    downloadReportTable('Range Master', `range-master-${new Date().toISOString().split('T')[0]}`, {
      summary: [{ label: 'Total Categories', value: String(data.length) }],
      headers: ['Category', 'Min Price', 'Max Price', 'Product Count'],
      columnAlign: ['left', 'right', 'right', 'right'],
      rows: data.map((item) => ({
        kind: 'data' as const,
        cells: [
          item.category,
          formatCurrency(item.minPrice),
          formatCurrency(item.maxPrice),
          item.productCount,
        ],
      })),
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Range Master"
        dateRange={false}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No data available.</div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Categories</div>
              <div className="text-2xl font-bold">{data.length}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">₹{item.minPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">₹{item.maxPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.productCount}</td>
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

