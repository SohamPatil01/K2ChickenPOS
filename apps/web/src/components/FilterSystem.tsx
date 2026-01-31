'use client';

import React, { useState, useEffect } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export interface FilterCriteria {
  dateRange: {
    start: string;
    end: string;
  };
  product?: string;
  category?: string;
  customer?: string;
  paymentMethod?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterCriteria;
}

interface FilterSystemProps {
  onFilterChange: (filters: FilterCriteria) => void;
  availableProducts?: Array<{ id: string; name: string }>;
  availableCategories?: Array<{ id: string; name: string }>;
  availableCustomers?: Array<{ id: string; name: string }>;
  showProductFilter?: boolean;
  showCategoryFilter?: boolean;
  showCustomerFilter?: boolean;
  showPaymentMethodFilter?: boolean;
  showStatusFilter?: boolean;
  showAmountFilter?: boolean;
  storageKey?: string;
}

export const FilterSystem: React.FC<FilterSystemProps> = ({
  onFilterChange,
  availableProducts = [],
  availableCategories = [],
  availableCustomers = [],
  showProductFilter = false,
  showCategoryFilter = false,
  showCustomerFilter = false,
  showPaymentMethodFilter = true,
  showStatusFilter = false,
  showAmountFilter = false,
  storageKey = 'report_filters',
}) => {
  const [filters, setFilters] = useState<FilterCriteria>({
    dateRange: {
      start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    },
  });
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  // Load presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`${storageKey}_presets`);
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load presets:', e);
      }
    }
  }, [storageKey]);

  // Apply filters
  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const savePresets = (newPresets: FilterPreset[]) => {
    setPresets(newPresets);
    localStorage.setItem(`${storageKey}_presets`, JSON.stringify(newPresets));
  };

  const handleDatePreset = (preset: string) => {
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (preset) {
      case 'today':
        start = today;
        break;
      case 'yesterday':
        start = subDays(today, 1);
        end = subDays(today, 1);
        break;
      case 'last7days':
        start = subDays(today, 7);
        break;
      case 'last30days':
        start = subDays(today, 30);
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(today), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'thisWeek':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      default:
        return;
    }

    setFilters(prev => ({
      ...prev,
      dateRange: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      },
    }));
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: { ...filters },
    };

    savePresets([...presets, newPreset]);
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    setFilters(preset.filters);
    setShowPresets(false);
  };

  const handleDeletePreset = (presetId: string) => {
    savePresets(presets.filter(p => p.id !== presetId));
  };

  const handleClearFilters = () => {
    setFilters({
      dateRange: {
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
      },
    });
  };

  const activeFilterCount = Object.keys(filters).filter(key => {
    if (key === 'dateRange') return false;
    return filters[key as keyof FilterCriteria] !== undefined && filters[key as keyof FilterCriteria] !== '';
  }).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSavePreset(!showSavePreset)}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            💾 Save Preset
          </button>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            📋 Presets ({presets.length})
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Save Preset Form */}
      {showSavePreset && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
              onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={() => setShowSavePreset(false)}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Presets List */}
      {showPresets && presets.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            {presets.map(preset => (
              <div key={preset.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                <button
                  onClick={() => handleLoadPreset(preset)}
                  className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => handleDeletePreset(preset.id)}
                  className="ml-2 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date Range Presets */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick Date Ranges
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'Last 7 Days', value: 'last7days' },
            { label: 'Last 30 Days', value: 'last30days' },
            { label: 'This Week', value: 'thisWeek' },
            { label: 'This Month', value: 'thisMonth' },
            { label: 'Last Month', value: 'lastMonth' },
          ].map(preset => (
            <button
              key={preset.value}
              onClick={() => handleDatePreset(preset.value)}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              dateRange: { ...prev.dateRange, start: e.target.value }
            }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              dateRange: { ...prev.dateRange, end: e.target.value }
            }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Additional Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {showPaymentMethodFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Method
            </label>
            <select
              value={filters.paymentMethod || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                paymentMethod: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT">Credit</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>
        )}

        {showStatusFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                status: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">All</option>
              <option value="PAID">Paid</option>
              <option value="OPEN">Open</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}

        {showProductFilter && availableProducts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product
            </label>
            <select
              value={filters.product || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                product: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Products</option>
              {availableProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showCategoryFilter && availableCategories.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={filters.category || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                category: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Categories</option>
              {availableCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showCustomerFilter && availableCustomers.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer
            </label>
            <select
              value={filters.customer || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                customer: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Customers</option>
              {availableCustomers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showAmountFilter && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Amount
              </label>
              <input
                type="number"
                value={filters.minAmount || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  minAmount: e.target.value ? parseFloat(e.target.value) : undefined
                }))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Amount
              </label>
              <input
                type="number"
                value={filters.maxAmount || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  maxAmount: e.target.value ? parseFloat(e.target.value) : undefined
                }))}
                placeholder="∞"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
          </>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
          {filters.paymentMethod && (
            <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center gap-1">
              Payment: {filters.paymentMethod}
              <button
                onClick={() => setFilters(prev => ({ ...prev, paymentMethod: undefined }))}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                ×
              </button>
            </span>
          )}
          {filters.status && (
            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full flex items-center gap-1">
              Status: {filters.status}
              <button
                onClick={() => setFilters(prev => ({ ...prev, status: undefined }))}
                className="hover:text-green-900 dark:hover:text-green-100"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterSystem;

