'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui';

interface ReportSettings {
  defaultDateRange: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  decimalPlaces: number;
  showTaxBreakdown: boolean;
  showDiscountBreakdown: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // in minutes
}

export default function ReportSettings() {
  const [settings, setSettings] = useState<ReportSettings>({
    defaultDateRange: 'last7days',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₹',
    currencyPosition: 'before',
    decimalPlaces: 2,
    showTaxBreakdown: true,
    showDiscountBreakdown: true,
    autoRefresh: false,
    refreshInterval: 5,
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem('reportSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...settings, ...parsed });
      } catch (e) {
        console.error('Failed to parse saved report settings', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('reportSettings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const defaults: ReportSettings = {
      defaultDateRange: 'last7days',
      dateFormat: 'DD/MM/YYYY',
      currencySymbol: '₹',
      currencyPosition: 'before',
      decimalPlaces: 2,
      showTaxBreakdown: true,
      showDiscountBreakdown: true,
      autoRefresh: false,
      refreshInterval: 5,
    };
    setSettings(defaults);
    localStorage.setItem('reportSettings', JSON.stringify(defaults));
    alert('Report settings reset to defaults!');
  };

  return (
    <Card hasAccent>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Report Settings</h2>
        <p className="text-gray-600 text-sm mt-1">Configure default report preferences and display options</p>
      </div>

      <div className="space-y-6">
        {/* Default Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Date Range</label>
          <select
            value={settings.defaultDateRange}
            onChange={(e) => setSettings({ ...settings, defaultDateRange: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Date Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
          <select
            value={settings.dateFormat}
            onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        {/* Currency Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
            <input
              type="text"
              value={settings.currencySymbol}
              onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              maxLength={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency Position</label>
            <select
              value={settings.currencyPosition}
              onChange={(e) => setSettings({ ...settings, currencyPosition: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="before">Before (₹100)</option>
              <option value="after">After (100₹)</option>
            </select>
          </div>
        </div>

        {/* Decimal Places */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Decimal Places</label>
          <input
            type="number"
            value={settings.decimalPlaces}
            onChange={(e) => setSettings({ ...settings, decimalPlaces: parseInt(e.target.value) || 2 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="0"
            max="4"
          />
        </div>

        {/* Display Options */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Display Options</label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showTaxBreakdown"
              checked={settings.showTaxBreakdown}
              onChange={(e) => setSettings({ ...settings, showTaxBreakdown: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="showTaxBreakdown" className="text-sm text-gray-700">
              Show Tax Breakdown
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showDiscountBreakdown"
              checked={settings.showDiscountBreakdown}
              onChange={(e) => setSettings({ ...settings, showDiscountBreakdown: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="showDiscountBreakdown" className="text-sm text-gray-700">
              Show Discount Breakdown
            </label>
          </div>
        </div>

        {/* Auto Refresh */}
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={settings.autoRefresh}
              onChange={(e) => setSettings({ ...settings, autoRefresh: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="autoRefresh" className="text-sm text-gray-700">
              Auto Refresh Reports
            </label>
          </div>
          {settings.autoRefresh && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Refresh Interval (minutes)</label>
              <input
                type="number"
                value={settings.refreshInterval}
                onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="1"
                max="60"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="primary" onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            Reset to Defaults
          </Button>
        </div>
      </div>
    </Card>
  );
}

