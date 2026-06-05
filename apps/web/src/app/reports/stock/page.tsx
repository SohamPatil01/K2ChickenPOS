'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { MasaleTypeBadge } from '@/components/ReportMasaleSummary';
import { useState, useEffect } from 'react';
import {
  downloadReportTable,
  formatCurrency,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function StockReportPage() {
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState<any[]>([]);

  useEffect(() => {
    loadStockData();
  }, []);

  const loadStockData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/reports/stock');
      setStockData(response.data || []);
    } catch (error) {
      console.error('Failed to load stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalValue = stockData.reduce((sum, item) => sum + item.stockValue, 0);
  const masaleStock = stockData.filter((item) => item.isMasale);
  const masaleStockValue = masaleStock.reduce((sum, item) => sum + item.stockValue, 0);

  const handleExport = () => {
    downloadReportTable('Stock Report', `stock-report-${new Date().toISOString().split('T')[0]}`, {
      summary: [
        { label: 'Total Products', value: String(stockData.length) },
        { label: 'Total Stock Value', value: formatCurrency(totalValue) },
        { label: 'Masale Products', value: String(masaleStock.length) },
        { label: 'Masale Stock Value', value: formatCurrency(masaleStockValue) },
      ],
      headers: ['Type', 'Product', 'SKU', 'PLU', 'Category', 'Current Stock', 'Unit', 'Price', 'Stock Value'],
      columnAlign: ['left', 'left', 'left', 'left', 'left', 'right', 'left', 'right', 'right'],
      rows: stockData.map((item) => ({
        kind: 'data' as const,
        cells: [
          item.isMasale ? 'Masale' : 'Chicken',
          item.name,
          item.sku,
          item.plu,
          item.category,
          item.currentStock,
          item.unitType,
          formatCurrency(item.price),
          formatCurrency(item.stockValue),
        ],
      })),
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Stock Report"
        dateRange={false}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading stock data...</div>
        ) : stockData.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No stock data available.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Products</div>
                  <div className="text-2xl font-bold dark:text-white">{stockData.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Stock Value</div>
                  <div className="text-2xl font-bold dark:text-white">₹{totalValue.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Items in Stock</div>
                  <div className="text-2xl font-bold dark:text-white">
                    {stockData.filter((item) => item.currentStock > 0).length}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Masale Products</div>
                  <div className="text-xl font-bold text-brand-700 dark:text-brand-300">{masaleStock.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Masale Stock Value</div>
                  <div className="text-xl font-bold text-brand-700 dark:text-brand-300">₹{masaleStockValue.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PLU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stockData.map((item) => (
                    <tr 
                      key={item.productId} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        item.isMasale ? 'bg-brand-50/20 dark:bg-brand-900/10' : item.currentStock === 0 ? 'dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-sm"><MasaleTypeBadge isMasale={item.isMasale} /></td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{item.sku}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{item.plu}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{item.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                        {item.currentStock.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{item.unitType}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">₹{item.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                        ₹{item.stockValue.toFixed(2)}
                      </td>
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

