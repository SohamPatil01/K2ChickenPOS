'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Store {
  id: string;
  name: string;
  type: string;
}

interface StoreRegionSwitcherProps {
  selectedStoreId: string | null;
  selectedRegion: string | null;
  onStoreChange: (storeId: string | null) => void;
  onRegionChange: (region: string | null) => void;
}

export default function StoreRegionSwitcher({
  selectedStoreId,
  selectedRegion,
  onStoreChange,
  onRegionChange,
}: StoreRegionSwitcherProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStores();
    loadRegions();
  }, []);

  const loadStores = async () => {
    try {
      const response = await api.get('/api/v1/stores?type=FRANCHISE');
      setStores(response.data || []);
    } catch (error) {
      console.error('Failed to load stores:', error);
    }
  };

  const loadRegions = async () => {
    try {
      // Extract unique regions from stores (assuming stores have a region field)
      // For now, we'll use a placeholder
      setRegions(['North', 'South', 'East', 'West', 'Central']);
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  };

  return (
    <div className="flex gap-2 mb-4">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Store
        </label>
        <select
          value={selectedStoreId || ''}
          onChange={(e) => onStoreChange(e.target.value || null)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All Stores</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Region
        </label>
        <select
          value={selectedRegion || ''}
          onChange={(e) => onRegionChange(e.target.value || null)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All Regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

