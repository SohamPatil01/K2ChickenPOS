'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tallyPaymentsFromSales, tallyToClosingFields } from '@azela-pos/shared';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { localDateRangeToApiBounds, todayLocalYmd } from '@/lib/dateRangeParams';
import { Button, Card } from '@/components/ui';

export default function DailyClosingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [closingDate, setClosingDate] = useState(todayLocalYmd());
  const [existingClosing, setExistingClosing] = useState<any>(null);
  const [formData, setFormData] = useState({
    openingCash: 0,
    cashReceived: 0,
    closingCash: 0,
    notes: '',
  });
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadClosing();
  }, [user, router, closingDate]);

  const loadClosing = async () => {
    setLoading(true);
    try {
      // Encode the date to handle any special characters
      const encodedDate = encodeURIComponent(closingDate);
      const response = await api.get(`/api/v1/daily-closing/${encodedDate}`);
      setExistingClosing(response.data);
      setFormData({
        openingCash: response.data.openingCash || 0,
        cashReceived: response.data.cashReceived || 0,
        closingCash: response.data.closingCash || 0,
        notes: response.data.notes || '',
      });
      // Set summary from API response
      setSummary({
        totalSales: response.data.totalSales || 0,
        totalRevenue: response.data.totalRevenue || 0,
        totalDiscounts: response.data.totalDiscounts || 0,
        totalTax: response.data.totalTax || 0,
        totalWeightSoldKg: response.data.totalWeightSoldKg || 0,
        totalWastageKg: response.data.totalWastageKg || 0,
        cashSales: response.data.cashSales || 0,
        cardSales: response.data.cardSales || 0,
        upiSales: response.data.upiSales || 0,
      });
      // Auto-set cashReceived from cashSales
      if (response.data.cashSales !== undefined) {
        setFormData(prev => ({ ...prev, cashReceived: response.data.cashSales || 0 }));
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setExistingClosing(null);
        try {
          const { startDate, endDate } = localDateRangeToApiBounds(closingDate, closingDate);
          const salesRes = await api.get('/api/v1/sales', {
            params: { startDate, endDate, status: 'PAID' },
          });
          const sales = salesRes.data || [];
          const paymentTotals = tallyPaymentsFromSales(sales);
          const { cashSales, cardSales, upiSales } = tallyToClosingFields(paymentTotals);
          const totalRevenue = sales.reduce(
            (sum: number, sale: any) => sum + (sale.grandTotal || 0),
            0
          );
          setSummary({
            totalSales: sales.length,
            totalRevenue,
            totalDiscounts: 0,
            totalTax: 0,
            totalWeightSoldKg: 0,
            totalWastageKg: 0,
            cashSales,
            cardSales,
            upiSales,
          });
          if (cashSales !== undefined) {
            setFormData((prev) => ({ ...prev, cashReceived: cashSales || 0 }));
          }
        } catch (salesError) {
          console.error('Failed to fetch sales data:', salesError);
          await loadSummary();
        }
      } else {
        console.error('Failed to load daily closing:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      // The API will calculate everything when we save/load the closing
      // For now, set empty summary - it will be populated from existing closing or calculated by API
      setSummary({
        totalSales: 0,
        totalRevenue: 0,
        totalDiscounts: 0,
        totalTax: 0,
        totalWeightSoldKg: 0,
        totalWastageKg: 0,
        cashSales: 0,
        cardSales: 0,
        upiSales: 0,
      });
    } catch (error: any) {
      console.error('Failed to load summary:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.openingCash && !formData.closingCash) {
      alert('Please enter opening cash and closing cash');
      return;
    }

    try {
      const response = await api.post('/api/v1/daily-closing', {
        closingDate,
        openingCash: formData.openingCash,
        cashReceived: formData.cashReceived,
        closingCash: formData.closingCash,
        notes: formData.notes,
      });
      setExistingClosing(response.data);
        // Update summary from API response
        if (response.data) {
          setSummary({
            totalSales: response.data.totalSales || 0,
            totalRevenue: response.data.totalRevenue || 0,
            totalDiscounts: response.data.totalDiscounts || 0,
            totalTax: response.data.totalTax || 0,
            totalWeightSoldKg: response.data.totalWeightSoldKg || 0,
            totalWastageKg: response.data.totalWastageKg || 0,
            cashSales: response.data.cashSales || 0,
            cardSales: response.data.cardSales || 0,
            upiSales: response.data.upiSales || 0,
          });
          // Auto-set cashReceived from cashSales
          if (response.data.cashSales !== undefined) {
            setFormData(prev => ({ ...prev, cashReceived: response.data.cashSales || 0 }));
          }
        }
      alert('Daily closing saved successfully!');
    } catch (error: any) {
      console.error('Failed to save daily closing:', error);
      alert(error.response?.data?.error || 'Failed to save daily closing');
    }
  };

  const handleFinalize = async () => {
    if (!existingClosing) {
      alert('Please save the closing first');
      return;
    }

    if (!confirm('Are you sure you want to finalize this daily closing? This action cannot be undone.')) {
      return;
    }

    try {
      await api.patch(`/api/v1/daily-closing/${existingClosing.id}/finalize`);
      await loadClosing();
      alert('Daily closing finalized successfully!');
    } catch (error: any) {
      console.error('Failed to finalize daily closing:', error);
      alert(error.response?.data?.error || 'Failed to finalize daily closing');
    }
  };

  // Auto-set cashReceived from cashSales when summary changes
  useEffect(() => {
    if (summary?.cashSales !== undefined) {
      setFormData(prev => ({ ...prev, cashReceived: summary.cashSales || 0 }));
    }
  }, [summary?.cashSales]);

  // Auto-calculate closing cash when opening cash or cash received changes
  useEffect(() => {
    if (formData.openingCash !== undefined && formData.cashReceived !== undefined) {
      const calculatedClosingCash = (formData.openingCash || 0) + (formData.cashReceived || 0);
      setFormData(prev => ({ ...prev, closingCash: calculatedClosingCash }));
    }
  }, [formData.openingCash, formData.cashReceived]);

  const cashExpected = (formData.openingCash || 0) + (formData.cashReceived || 0);
  const cashDifference = (formData.closingCash || 0) - cashExpected;

  if (loading && !summary) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold dark:text-white">Daily Closing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Reconcile cash, weight, wastage, and closing stock</p>
        </div>

        {/* Date Selector */}
        <Card className="mb-6">
          <div className="p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Closing Date</label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            />
          </div>
        </Card>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold dark:text-white">{summary.totalSales}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">₹{summary.totalRevenue.toLocaleString()}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-600 dark:text-gray-400">Weight Sold</p>
              <p className="text-2xl font-bold dark:text-white">{summary.totalWeightSoldKg.toFixed(2)} kg</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total weight</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-600 dark:text-gray-400">Wastage</p>
              <p className="text-2xl font-bold dark:text-white">{summary.totalWastageKg.toFixed(2)} kg</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total wastage</p>
            </Card>
          </div>
        )}

        {/* Cash Reconciliation */}
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Cash Reconciliation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opening Cash</label>
                <input
                  type="number"
                  value={formData.openingCash || ''}
                  onChange={(e) => setFormData({ ...formData, openingCash: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  step="0.001"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cash Sales</label>
                <input
                  type="number"
                  value={summary?.cashSales || 0}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cash Received
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Auto from Cash Sales)</span>
                </label>
                <input
                  type="number"
                  value={formData.cashReceived || 0}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Cash</label>
                <input
                  type="number"
                  value={cashExpected.toFixed(3)}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Closing Cash
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Auto-calculated: Opening + Cash Received)</span>
                </label>
                <input
                  type="number"
                  value={formData.closingCash || 0}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cash Difference</label>
                <input
                  type="number"
                  value={cashDifference.toFixed(3)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-md ${
                    cashDifference === 0
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-400'
                      : cashDifference > 0
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-400'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Method Breakdown */}
        {summary && (
          <Card className="mb-6">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 dark:text-white">Payment Method Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cash</p>
                  <p className="text-2xl font-bold dark:text-white">₹{summary.cashSales.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Card</p>
                  <p className="text-2xl font-bold dark:text-white">₹{summary.cardSales.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">UPI</p>
                  <p className="text-2xl font-bold dark:text-white">₹{summary.upiSales.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card className="mb-6">
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              rows={3}
              placeholder="Add any notes or observations..."
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="primary" onClick={handleSubmit}>
            {existingClosing ? 'Update Closing' : 'Save Closing'}
          </Button>
          {existingClosing && !existingClosing.isFinalized && (
            <Button variant="primary" onClick={handleFinalize}>
              Finalize Closing
            </Button>
          )}
          {existingClosing && existingClosing.isFinalized && (
            <span className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-md font-semibold">
              ✓ Finalized
            </span>
          )}
        </div>
      </div>
    </Layout>
  );
}

