'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface Product {
  id: string;
  name: string;
  sku: string;
  unitType: 'KG' | 'PCS';
  productMaster?: {
    wastageTolerancePercent: number;
  };
}

interface FranchiseConfig {
  allowedWastagePercent: number;
  isWastageLocked: boolean;
}

interface WastageEntry {
  productId: string;
  wastageType: 'CUTTING_LOSS' | 'SPOILAGE';
  qtyKg: number;
  qtyPcs?: number;
  reason: string;
}

export default function WastageManagementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [franchiseConfig, setFranchiseConfig] = useState<FranchiseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [wastageEntry, setWastageEntry] = useState<WastageEntry>({
    productId: '',
    wastageType: 'CUTTING_LOSS',
    qtyKg: 0,
    reason: '',
  });
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    wastagePercent: number;
    allowedPercent: number;
    isExcess: boolean;
    message: string;
  } | null>(null);
  const [recentWastage, setRecentWastage] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== 'MANAGER' && user.role !== 'OWNER')) {
      router.push('/store');
      return;
    }
    // Only load data once, not on every render
    if (!dataLoaded) {
      loadData();
    }
  }, [user, router, dataLoaded]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsRes, configRes, wastageRes] = await Promise.all([
        api.get('/api/v1/products'),
        api.get('/api/v1/stores/franchise-config').catch(() => ({ data: null })),
        api.get('/api/v1/inventory/ledger', {
          params: {
            reason: 'WASTAGE',
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
          },
        }),
      ]);

      // Load products with productMaster data in batches to avoid too many requests
      const productsData = productsRes.data || [];
      
      // Process in batches of 5 with delay between batches
      const batchSize = 5;
      const delayBetweenBatches = 100;
      const productsWithMaster: Product[] = [];
      
      for (let i = 0; i < productsData.length; i += batchSize) {
        const batch = productsData.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (p: any) => {
            try {
              const masterRes = await api.get(`/api/v1/hq/product-master?productId=${p.id}`).catch(() => null);
              return {
                ...p,
                productMaster: masterRes?.data?.[0] || null,
              };
            } catch {
              return {
                ...p,
                productMaster: null,
              };
            }
          })
        );
        
        productsWithMaster.push(...batchResults);
        
        // Add delay between batches (except for the last batch)
        if (i + batchSize < productsData.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
      
      setProducts(productsWithMaster);

      // Handle both single config object (from franchise-config endpoint) and array (from HQ endpoint)
      const config = configRes.data && !Array.isArray(configRes.data) 
        ? configRes.data 
        : (Array.isArray(configRes.data) 
          ? configRes.data.find((c: any) => c.franchiseStoreId === user?.storeId) || configRes.data[0] || null
          : null);
      
      if (config) {
        setFranchiseConfig({
          allowedWastagePercent: config.allowedWastagePercent || 5.0,
          isWastageLocked: config.isWastageLocked || false,
        });
      } else {
        // Set default config if not found
        setFranchiseConfig({
          allowedWastagePercent: 5.0,
          isWastageLocked: false,
        });
      }
      setRecentWastage(wastageRes.data || []);
      setDataLoaded(true);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      // Set default config on error
      setFranchiseConfig({
        allowedWastagePercent: 5.0,
        isWastageLocked: false,
      });
      alert(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const validateWastage = async () => {
    if (!wastageEntry.productId || !wastageEntry.qtyKg) {
      setValidationResult(null);
      return;
    }

    try {
      const product = products.find((p) => p.id === wastageEntry.productId);
      if (!product) return;

      // Get total received stock for this product in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const receivedRes = await api.get('/api/v1/inventory/ledger', {
        params: {
          productId: wastageEntry.productId,
          type: 'IN',
          reason: 'RECEIVE',
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      const totalReceived = (receivedRes.data || []).reduce(
        (sum: number, ledger: any) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
        0
      );

      // Get existing wastage for this product in last 30 days
      const wastageRes = await api.get('/api/v1/inventory/ledger', {
        params: {
          productId: wastageEntry.productId,
          reason: 'WASTAGE',
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      const existingWastage = (wastageRes.data || []).reduce(
        (sum: number, ledger: any) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
        0
      );

      const totalWastage = existingWastage + wastageEntry.qtyKg;
      const wastagePercent = totalReceived > 0 ? (totalWastage / totalReceived) * 100 : 0;

      // Get allowed wastage (product-specific or franchise default)
      const allowedPercent =
        product.productMaster?.wastageTolerancePercent ||
        franchiseConfig?.allowedWastagePercent ||
        5.0;

      const isExcess = wastagePercent > allowedPercent;
      const excessAmount = Math.max(0, wastagePercent - allowedPercent);

      setValidationResult({
        isValid: !isExcess || !franchiseConfig?.isWastageLocked,
        wastagePercent,
        allowedPercent,
        isExcess,
        message: isExcess
          ? `⚠️ Excess wastage detected! Current: ${wastagePercent.toFixed(2)}% (Allowed: ${allowedPercent}%). Excess: ${excessAmount.toFixed(2)}%`
          : `✅ Wastage within limits. Current: ${wastagePercent.toFixed(2)}% (Allowed: ${allowedPercent}%)`,
      });
    } catch (error: any) {
      console.error('Failed to validate wastage:', error);
    }
  };

  useEffect(() => {
    if (wastageEntry.productId && wastageEntry.qtyKg > 0) {
      validateWastage();
    } else {
      setValidationResult(null);
    }
  }, [wastageEntry.productId, wastageEntry.qtyKg, franchiseConfig, products]);

  const handleSubmit = async () => {
    if (!wastageEntry.productId || !wastageEntry.qtyKg || !wastageEntry.reason.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (franchiseConfig?.isWastageLocked && validationResult?.isExcess) {
      alert('Wastage is locked by HQ. Excess wastage entries are not allowed.');
      return;
    }

    try {
      await api.post('/api/v1/inventory/wastage', {
        productId: wastageEntry.productId,
        qtyKg: wastageEntry.qtyKg,
        qtyPcs: wastageEntry.qtyPcs,
        reason: `${wastageEntry.wastageType}: ${wastageEntry.reason}`,
      });

      alert('Wastage recorded successfully!');
      setShowEntryModal(false);
      setWastageEntry({
        productId: '',
        wastageType: 'CUTTING_LOSS',
        qtyKg: 0,
        reason: '',
      });
      setValidationResult(null);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to record wastage');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Wastage Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Record and track wastage</p>
        </div>
        <button
          onClick={() => setShowEntryModal(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600"
        >
          + Record Wastage
        </button>
      </div>

      {/* HQ Lock Warning */}
      {franchiseConfig?.isWastageLocked && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600 dark:text-yellow-400">🔒</span>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Wastage thresholds are locked by HQ. Excess wastage entries will be rejected.
            </p>
          </div>
        </div>
      )}

      {/* Threshold Info */}
      {franchiseConfig && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <h2 className="text-lg font-semibold dark:text-white mb-4">Wastage Thresholds</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Franchise Allowed Wastage:</p>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {franchiseConfig.allowedWastagePercent}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status:</p>
              <p className="text-lg font-semibold dark:text-white">
                {franchiseConfig.isWastageLocked ? '🔒 Locked by HQ' : '✅ Unlocked'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Wastage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">Recent Wastage Entries (Last 7 Days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Quantity (Kg)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentWastage.length > 0 ? (
                recentWastage.map((entry) => {
                  const reason = entry.metaJson?.reason || entry.reason || 'WASTAGE';
                  const wastageType = reason.includes('CUTTING_LOSS') ? 'Cutting Loss' : reason.includes('SPOILAGE') ? 'Spoilage' : 'Other';
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium dark:text-white">
                        {entry.product?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {wastageType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {entry.qtyKg?.toFixed(2) || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {reason.replace('CUTTING_LOSS: ', '').replace('SPOILAGE: ', '')}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No wastage entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-2xl font-bold dark:text-white mb-4">Record Wastage</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product *
                </label>
                <select
                  value={wastageEntry.productId}
                  onChange={(e) => setWastageEntry({ ...wastageEntry, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Wastage Type *
                </label>
                <select
                  value={wastageEntry.wastageType}
                  onChange={(e) =>
                    setWastageEntry({
                      ...wastageEntry,
                      wastageType: e.target.value as 'CUTTING_LOSS' | 'SPOILAGE',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                >
                  <option value="CUTTING_LOSS">Cutting Loss</option>
                  <option value="SPOILAGE">Spoilage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity (Kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={wastageEntry.qtyKg || ''}
                  onChange={(e) => setWastageEntry({ ...wastageEntry, qtyKg: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason/Notes *
                </label>
                <textarea
                  value={wastageEntry.reason}
                  onChange={(e) => setWastageEntry({ ...wastageEntry, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  rows={3}
                  placeholder="Enter reason for wastage..."
                  required
                />
              </div>

              {/* Validation Result - Always show when product and quantity are entered */}
              {validationResult && wastageEntry.productId && wastageEntry.qtyKg > 0 && (
                <div
                  className={`p-4 rounded-md border-2 ${
                    validationResult.isExcess
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {validationResult.isExcess ? '⚠️' : '✅'}
                    </span>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold mb-1 ${
                          validationResult.isExcess
                            ? 'text-red-800 dark:text-red-300'
                            : 'text-green-800 dark:text-green-300'
                        }`}
                      >
                        {validationResult.isExcess ? 'Excess Wastage Detected' : 'Wastage Within Limits'}
                      </p>
                      <p
                        className={`text-sm ${
                          validationResult.isExcess
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-green-700 dark:text-green-400'
                        }`}
                      >
                        {validationResult.message}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <span className="text-gray-600 dark:text-gray-400">
                          Current: <strong>{validationResult.wastagePercent.toFixed(2)}%</strong>
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Allowed: <strong>{validationResult.allowedPercent}%</strong>
                        </span>
                        {validationResult.isExcess && (
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            Excess: {(validationResult.wastagePercent - validationResult.allowedPercent).toFixed(2)}%
                          </span>
                        )}
                      </div>
                      {franchiseConfig?.isWastageLocked && validationResult.isExcess && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">
                          🔒 Wastage is locked by HQ. This entry will be rejected.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowEntryModal(false);
                    setWastageEntry({
                      productId: '',
                      wastageType: 'CUTTING_LOSS',
                      qtyKg: 0,
                      reason: '',
                    });
                    setValidationResult(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!validationResult?.isValid && franchiseConfig?.isWastageLocked}
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Record Wastage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

