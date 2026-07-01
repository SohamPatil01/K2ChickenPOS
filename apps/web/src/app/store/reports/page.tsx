'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { CA_REPORT_ITEMS } from '@/lib/caReports';

export default function StoreReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

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
  }, [user, router]);

  const handleReportClick = (path: string, id: string) => {
    setSelectedReport(id);
    router.push(path);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-brand-500 dark:bg-brand-600 text-white py-3 sm:py-4 px-4 sm:px-6 shadow-md rounded-t-lg">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Reports</h1>
        <p className="text-sm text-brand-100 mt-1">CA-style registers for accounts & audit</p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md overflow-hidden rounded-b-lg">
        {CA_REPORT_ITEMS.map((item, index) => (
          <div key={item.id}>
            <button
              onClick={() => handleReportClick(item.path, item.id)}
              className={`w-full text-left py-3 sm:py-4 px-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors touch-target ${
                selectedReport === item.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
              }`}
            >
              <span className="text-gray-800 dark:text-gray-200 font-medium text-sm sm:text-base">
                {item.label}
              </span>
            </button>
            {index < CA_REPORT_ITEMS.length - 1 && (
              <hr className="border-gray-200 dark:border-gray-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
