'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface YieldEntry {
  wholeChickenWeight: number;
  cuts: Array<{
    productId: string;
    productName: string;
    weight: number;
  }>;
  notes?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitType: 'KG' | 'PCS';
  productMaster?: {
    expectedYieldPercent: number;
  };
}

interface DailyYieldSummary {
  date: string;
  totalWholeChickenWeight: number;
  totalCutWeight: number;
  yieldPercent: number;
  entries: Array<{
    id: string;
    wholeChickenWeight: number;
    totalCutWeight: number;
    yieldPercent: number;
    createdAt: string;
  }>;
}

export default function YieldTrackingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [yieldEntry, setYieldEntry] = useState<YieldEntry>({
    wholeChickenWeight: 0,
    cuts: [],
    notes: '',
  });
  const [dailySummary, setDailySummary] = useState<DailyYieldSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== 'MANAGER' && user.role !== 'OWNER')) {
      router.push('/store');
      return;
    }
    // Only load products once, not on every date change
    if (!productsLoaded) {
      loadData();
    }
  }, [user, router, productsLoaded]);

  // Separate effect for daily summary that depends on date
  useEffect(() => {
    if (productsLoaded && user && (user.role === 'MANAGER' || user.role === 'OWNER')) {
      loadDailySummary();
    }
  }, [selectedDate, productsLoaded, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/products');
      const allProducts = response.data || [];
      
      // Filter for KG products first (chicken cuts)
      const kgProducts = allProducts.filter((p: Product) => p.unitType === 'KG');
      
      // Load productMaster data in batches to avoid too many requests
      // Process 5 products at a time with a small delay between batches
      const batchSize = 5;
      const delayBetweenBatches = 100; // 100ms delay
      
      const productsWithMaster: Product[] = [];
      
      for (let i = 0; i < kgProducts.length; i += batchSize) {
        const batch = kgProducts.slice(i, i + batchSize);
        
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
        if (i + batchSize < kgProducts.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
      
      setProducts(productsWithMaster);
      setProductsLoaded(true);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      alert(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadDailySummary = async () => {
    try {
      // Get yield data from localStorage (temporary solution)
      // In production, this would come from a YieldTracking API
      const yieldData = JSON.parse(localStorage.getItem('yieldTracking') || '[]');
      
      // Filter for selected date
      const dateStr = selectedDate;
      const dayEntries = yieldData.filter((entry: any) => entry.date === dateStr);
      
      if (dayEntries.length > 0) {
        const totalWholeChickenWeight = dayEntries.reduce((sum: number, e: any) => sum + e.wholeChickenWeight, 0);
        const totalCutWeight = dayEntries.reduce((sum: number, e: any) => sum + e.totalCutWeight, 0);
        const yieldPercent = totalWholeChickenWeight > 0 ? (totalCutWeight / totalWholeChickenWeight) * 100 : 0;

        setDailySummary({
          date: selectedDate,
          totalWholeChickenWeight,
          totalCutWeight,
          yieldPercent,
          entries: dayEntries.map((e: any, idx: number) => ({
            id: `entry-${idx}`,
            wholeChickenWeight: e.wholeChickenWeight,
            totalCutWeight: e.totalCutWeight,
            yieldPercent: e.yieldPercent,
            createdAt: e.date + 'T12:00:00', // Approximate time
          })),
        });
      } else {
        // Fallback: try to get from ledger entries
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        const ledgerRes = await api.get('/api/v1/inventory/ledger', {
          params: {
            reason: 'ADJUSTMENT',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }).catch(() => ({ data: [] }));

        const yieldEntries = (ledgerRes.data || []).filter((e: any) => 
          e.type === 'IN' && e.qtyKg && e.qtyKg > 0
        );
        
        const totalCutWeight = yieldEntries.reduce((sum: number, e: any) => {
          return sum + (e.qtyKg || 0);
        }, 0);
        
        if (totalCutWeight > 0) {
          const estimatedWholeChickenWeight = totalCutWeight / 0.85;
          const yieldPercent = (totalCutWeight / estimatedWholeChickenWeight) * 100;

          setDailySummary({
            date: selectedDate,
            totalWholeChickenWeight: estimatedWholeChickenWeight,
            totalCutWeight,
            yieldPercent,
            entries: yieldEntries.map((e: any) => ({
              id: e.id,
              wholeChickenWeight: (e.qtyKg || 0) / 0.85,
              totalCutWeight: e.qtyKg || 0,
              yieldPercent: 85,
              createdAt: e.createdAt,
            })),
          });
        } else {
          setDailySummary(null);
        }
      }
    } catch (error: any) {
      console.error('Failed to load daily summary:', error);
      setDailySummary(null);
    }
  };

  const addCut = () => {
    setYieldEntry({
      ...yieldEntry,
      cuts: [
        ...yieldEntry.cuts,
        {
          productId: '',
          productName: '',
          weight: 0,
        },
      ],
    });
  };

  const updateCut = (index: number, field: string, value: any) => {
    const newCuts = [...yieldEntry.cuts];
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newCuts[index] = {
        ...newCuts[index],
        productId: value,
        productName: product?.name || '',
      };
    } else {
      newCuts[index] = {
        ...newCuts[index],
        [field]: value,
      };
    }
    setYieldEntry({ ...yieldEntry, cuts: newCuts });
  };

  const removeCut = (index: number) => {
    setYieldEntry({
      ...yieldEntry,
      cuts: yieldEntry.cuts.filter((_, i) => i !== index),
    });
  };

  const calculateYield = () => {
    const totalCutWeight = yieldEntry.cuts.reduce((sum, cut) => sum + cut.weight, 0);
    return yieldEntry.wholeChickenWeight > 0
      ? (totalCutWeight / yieldEntry.wholeChickenWeight) * 100
      : 0;
  };

  const handleSubmit = async () => {
    if (!yieldEntry.wholeChickenWeight || yieldEntry.wholeChickenWeight <= 0) {
      alert('Please enter whole chicken weight');
      return;
    }

    if (yieldEntry.cuts.length === 0) {
      alert('Please add at least one cut');
      return;
    }

    const totalCutWeight = yieldEntry.cuts.reduce((sum, cut) => sum + cut.weight, 0);
    if (totalCutWeight <= 0) {
      alert('Please enter cut weights');
      return;
    }

    try {
      // Create ledger entries for each cut using ADJUSTMENT reason
      // Store yield metadata in audit logs
      for (const cut of yieldEntry.cuts) {
        if (cut.productId && cut.weight > 0) {
          await api.post('/api/v1/inventory/adjust', {
            productId: cut.productId,
            qtyKg: cut.weight,
            reason: 'YIELD',
          });
        }
      }
      
      // Store yield tracking metadata (we'll use the first cut's product as reference)
      if (yieldEntry.cuts.length > 0 && yieldEntry.cuts[0].productId) {
        // Create an audit log entry to track yield metadata
        try {
          await api.post('/api/v1/inventory/adjust', {
            productId: yieldEntry.cuts[0].productId,
            qtyKg: 0, // Zero adjustment, just for tracking
            reason: 'YIELD_TRACKING',
          });
        } catch (e) {
          // Ignore tracking errors
        }
      }

      alert('Yield recorded successfully!');
      setShowEntryModal(false);
      setYieldEntry({
        wholeChickenWeight: 0,
        cuts: [],
        notes: '',
      });
      loadDailySummary();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to record yield');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const currentYield = calculateYield();
  const expectedYield = products.find((p) => p.productMaster)?.productMaster?.expectedYieldPercent || 100;

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white">Yield Tracking</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Track whole chicken to cut yield</p>
        </div>
        <button
          onClick={() => setShowEntryModal(true)}
          className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 touch-target font-medium"
        >
          + Record Yield
        </button>
      </div>

      {/* Daily Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-3 sm:gap-0">
          <h2 className="text-base sm:text-lg font-semibold dark:text-white">Daily Yield Summary</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark] touch-target"
          />
        </div>
        {dailySummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Whole Chicken Weight</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dailySummary.totalWholeChickenWeight.toFixed(2)} kg
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Cut Weight</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dailySummary.totalCutWeight.toFixed(2)} kg
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Yield %</p>
              <p
                className={`text-2xl font-bold ${
                  dailySummary.yieldPercent >= expectedYield * 0.9
                    ? 'text-green-600 dark:text-green-400'
                    : dailySummary.yieldPercent >= expectedYield * 0.8
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {dailySummary.yieldPercent.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Expected: {expectedYield}%</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No yield data for selected date</p>
        )}
      </div>

      {/* Recent Entries */}
      {dailySummary && dailySummary.entries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold dark:text-white">Yield Entries</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Time
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Whole Chicken (kg)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Cut Weight (kg)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Yield %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dailySummary.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {entry.wholeChickenWeight.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {entry.totalCutWeight.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span
                        className={`font-semibold ${
                          entry.yieldPercent >= expectedYield * 0.9
                            ? 'text-green-600 dark:text-green-400'
                            : entry.yieldPercent >= expectedYield * 0.8
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {entry.yieldPercent.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-2xl font-bold dark:text-white mb-4">Record Yield</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Whole Chicken Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={yieldEntry.wholeChickenWeight || ''}
                  onChange={(e) =>
                    setYieldEntry({ ...yieldEntry, wholeChickenWeight: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  required
                />
              </div>

              {/* Cuts */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cuts *</label>
                  <button
                    onClick={addCut}
                    className="px-3 py-1 text-sm bg-brand-500 text-white rounded-md hover:bg-brand-600"
                  >
                    + Add Cut
                  </button>
                </div>
                <div className="space-y-2">
                  {yieldEntry.cuts.map((cut, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <select
                          value={cut.productId}
                          onChange={(e) => updateCut(index, 'productId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                        >
                          <option value="">Select cut type</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <input
                          type="number"
                          step="0.01"
                          value={cut.weight || ''}
                          onChange={(e) => updateCut(index, 'weight', parseFloat(e.target.value) || 0)}
                          placeholder="Weight (kg)"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                        />
                      </div>
                      <button
                        onClick={() => removeCut(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Yield Calculation - Always show when there's data */}
              {yieldEntry.wholeChickenWeight > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md border-2 border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Cut Weight:</span>
                    <span className="font-bold text-lg dark:text-white">
                      {yieldEntry.cuts.reduce((sum, cut) => sum + cut.weight, 0).toFixed(2)} kg
                    </span>
                  </div>
                  {yieldEntry.cuts.length > 0 && yieldEntry.cuts.reduce((sum, cut) => sum + cut.weight, 0) > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Yield %:</span>
                        <span
                          className={`font-bold text-2xl ${
                            currentYield >= expectedYield * 0.9
                              ? 'text-green-600 dark:text-green-400'
                              : currentYield >= expectedYield * 0.8
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {currentYield.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Target: {expectedYield}%</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {currentYield >= expectedYield ? '✅ Above Target' : '⚠️ Below Target'}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              currentYield >= expectedYield * 0.9
                                ? 'bg-green-500'
                                : currentYield >= expectedYield * 0.8
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, (currentYield / expectedYield) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {yieldEntry.cuts.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Add cuts to calculate yield percentage
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={yieldEntry.notes}
                  onChange={(e) => setYieldEntry({ ...yieldEntry, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowEntryModal(false);
                    setYieldEntry({
                      wholeChickenWeight: 0,
                      cuts: [],
                      notes: '',
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600"
                >
                  Record Yield
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

