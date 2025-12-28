'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

interface ReportItem {
  id: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

export default function StoreReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  useEffect(() => {
    // Wait for user to load
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Only MANAGER and OWNER can access reports
    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
      return;
    }
  }, [user, router]);

  const reportItems: ReportItem[] = [
    { id: 'stock', label: 'Stock', path: '/reports/stock' },
    { id: 'product-wise-sale', label: 'Product Wise Sale', path: '/reports/product-wise-sale' },
    { id: 'range-master', label: 'Range Master', path: '/reports/range-master' },
    { id: 'article-wise-sale', label: 'Artical Wise Sale', path: '/reports/article-wise-sale' },
    { id: 'bill-wise-sale', label: 'Bill Wise Sale', path: '/reports/bill-wise-sale' },
    { id: 'sales-register-summary', label: 'Sales Register Summery', path: '/reports/sales-register-summary' },
    { id: 'sales-sub-register', label: 'Sales Sub Register', path: '/reports/sales-sub-register' },
    { id: 'bill-wise-sale-cancel', label: 'Bill Wise Sale Cancel', path: '/reports/bill-wise-sale-cancel' },
    { id: 'po-report', label: 'PO Report', path: '/reports/po-report' },
    { id: 'summary-report', label: 'Summary Report', path: '/reports/summary-report' },
    { id: 'sku-wise-sales', label: 'SKU Wise Sales Report', path: '/reports/sku-wise-sales' },
    { id: 'pending', label: 'Pending', path: '/reports/pending' },
    { id: 'settings', label: 'Settings', path: '/reports/settings' },
    { id: 'mrn-balance', label: 'MRN & Balance Confirmation', path: '/reports/mrn-balance' },
  ];

  const handleReportClick = (item: ReportItem) => {
    setSelectedReport(item.id);
    if (item.path) {
      router.push(item.path);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Primary Header */}
      <div className="bg-brand-500 dark:bg-brand-600 text-white py-4 px-6 shadow-md rounded-t-lg">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
      </div>

      {/* Report Items List */}
      <div className="bg-white dark:bg-gray-800 shadow-md overflow-hidden rounded-b-lg">
        {reportItems.map((item, index) => (
          <div key={item.id}>
            <button
              onClick={() => handleReportClick(item)}
              className={`w-full text-left py-4 px-6 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors ${
                selectedReport === item.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
              }`}
            >
              <span className="text-gray-800 dark:text-gray-200 font-medium text-base">{item.label}</span>
            </button>
            {index < reportItems.length - 1 && (
              <hr className="border-gray-200 dark:border-gray-700" />
            )}
          </div>
        ))}
      </div>

      {/* Info Message */}
      <div className="mt-6 p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
        <p className="text-sm text-brand-700 dark:text-brand-300">
          <strong>Note:</strong> Click on any report to view detailed information. Reports are being developed and will be available soon.
        </p>
      </div>
    </div>
  );
}

