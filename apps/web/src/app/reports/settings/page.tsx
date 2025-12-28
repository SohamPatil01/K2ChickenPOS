'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    defaultDateRange: 30,
    autoRefresh: false,
    exportFormat: 'csv',
  });

  const handleSave = () => {
    localStorage.setItem('reportSettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
  };

  return (
    <Layout>
      <ReportLayout
        title="Report Settings"
        dateRange={false}
        exportable={false}
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Date Range (days)
            </label>
            <input
              type="number"
              value={settings.defaultDateRange}
              onChange={(e) => setSettings({ ...settings, defaultDateRange: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="1"
              max="365"
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => setSettings({ ...settings, autoRefresh: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Auto Refresh Reports</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Export Format
            </label>
            <select
              value={settings.exportFormat}
              onChange={(e) => setSettings({ ...settings, exportFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
            >
              Save Settings
            </button>
            <button
              onClick={() => router.push('/reports')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </ReportLayout>
    </Layout>
  );
}

