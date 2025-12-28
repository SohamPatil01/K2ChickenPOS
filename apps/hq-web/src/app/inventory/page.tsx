'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface Franchise {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('');
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadFranchises();
  }, [user, router]);

  useEffect(() => {
    if (selectedFranchiseId) {
      loadInventoryData();
    }
  }, [selectedFranchiseId]);

  const loadFranchises = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/stores/franchises');
      setFranchises(response.data || []);
      // Auto-select first franchise if available
      if (response.data && response.data.length > 0) {
        setSelectedFranchiseId(response.data[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryData = async () => {
    if (!selectedFranchiseId) return;
    
    setLoadingInventory(true);
    try {
      const response = await api.get('/api/v1/hq/inventory-monitoring', {
        params: { franchiseId: selectedFranchiseId },
      });
      // API returns an array, but with franchiseId param it should return single item
      const data = response.data || [];
      setInventoryData(data.length > 0 ? data[0] : null);
    } catch (error: any) {
      console.error('Failed to load inventory data:', error);
    } finally {
      setLoadingInventory(false);
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading franchises...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Inventory Monitoring</h1>
          <p className="text-sm text-gray-500">Monitor inventory levels across franchises</p>
        </div>

        {/* Franchise Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label htmlFor="franchise-select" className="text-sm font-medium text-gray-700">
              Select Franchise:
            </label>
            <select
              id="franchise-select"
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-w-[250px]"
            >
              <option value="">-- Select Franchise --</option>
              {franchises.map((franchise) => (
                <option key={franchise.id} value={franchise.id}>
                  {franchise.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        {selectedFranchiseId && (
          <div className="bg-white rounded-lg shadow p-6">
            {loadingInventory ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading inventory data...</p>
              </div>
            ) : inventoryData ? (
              <>
                <h2 className="text-xl font-semibold mb-4">{inventoryData.storeName}</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inventoryData.inventory?.map((item: any) => (
                        <tr key={item.productId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.productName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{item.sku}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{item.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={item.currentStock === 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                              {item.currentStock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(!inventoryData.inventory || inventoryData.inventory.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No inventory data available for this franchise</p>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No inventory data available</p>
              </div>
            )}
          </div>
        )}

        {!selectedFranchiseId && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Please select a franchise to view inventory</p>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

