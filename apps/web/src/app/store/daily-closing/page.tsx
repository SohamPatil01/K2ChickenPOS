'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function StoreDailyClosingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
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

  // Auto-set cashReceived from cashSales (cash revenue)
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

  // Listen for cash sale events to refresh data in real-time
  useEffect(() => {
    const handleCashSaleCompleted = () => {
      console.log('[Daily Closing] Cash sale completed, refreshing data...');
      loadClosing();
    };

    const handleSaleCreated = (event: any) => {
      // Check if it's a cash sale
      const paymentMethod = event.detail?.paymentMethod;
      if (paymentMethod === 'CASH') {
        console.log('[Daily Closing] Cash sale created, refreshing data...');
        loadClosing();
      }
    };

    window.addEventListener('cash-sale-completed', handleCashSaleCompleted);
    window.addEventListener('sale-created', handleSaleCreated as EventListener);

    return () => {
      window.removeEventListener('cash-sale-completed', handleCashSaleCompleted);
      window.removeEventListener('sale-created', handleSaleCreated as EventListener);
    };
  }, [closingDate]);

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
    } catch (error: any) {
      if (error.response?.status === 404) {
        // 404 is expected when no daily closing exists for this date - not an error
        setExistingClosing(null);
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
      } else {
        console.error('Failed to load daily closing:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (formData.openingCash === undefined || formData.openingCash === null || formData.openingCash < 0) {
      alert('Please enter a valid opening cash amount (must be 0 or greater)');
      return;
    }

    if (formData.closingCash === undefined || formData.closingCash === null || formData.closingCash < 0) {
      alert('Please enter a valid closing cash amount (must be 0 or greater)');
      return;
    }

    // Warning for large cash difference
    const diff = Math.abs(cashDifference);
    if (diff > 1000) {
      if (!confirm(`Warning: Cash difference is ₹${diff.toFixed(2)}. This is a large discrepancy. Do you want to continue?`)) {
        return;
      }
    }

    // Confirm if closing date is not today
    const today = new Date().toISOString().split('T')[0];
    if (closingDate !== today) {
      if (!confirm(`You are creating a daily closing for ${closingDate}, which is not today (${today}). Continue?`)) {
        return;
      }
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
      }
      alert('Daily closing saved successfully!');
    } catch (error: any) {
      console.error('Failed to save daily closing:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || 'Failed to save daily closing';
      alert(`Error: ${errorMsg}`);
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

  const cashExpected = (formData.openingCash || 0) + (formData.cashReceived || 0);
  const cashDifference = (formData.closingCash || 0) - cashExpected;

  if (loading && !summary) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white">Daily Closing</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Reconcile cash, weight, wastage, and closing stock</p>
      </div>

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

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
            <p className="text-xl sm:text-2xl font-bold dark:text-white">{summary.totalSales}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">₹{summary.totalRevenue.toLocaleString()}</p>
          </Card>
          <Card>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Weight Sold</p>
            <p className="text-xl sm:text-2xl font-bold dark:text-white">{summary.totalWeightSoldKg.toFixed(2)} kg</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total weight</p>
          </Card>
          <Card>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Wastage</p>
            <p className="text-xl sm:text-2xl font-bold dark:text-white">{summary.totalWastageKg.toFixed(2)} kg</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total wastage</p>
          </Card>
        </div>
      )}

      <Card className="mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 lg:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 dark:text-white">Cash Reconciliation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cash Sales (Generated Today)
              </label>
              <input
                type="number"
                value={(summary?.cashSales || 0).toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800 font-semibold"
              />
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ₹{(summary?.cashSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cash Received
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Auto from Cash Sales)</span>
              </label>
              <input
                type="number"
                value={(formData.cashReceived || 0).toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800 font-semibold"
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
                value={(formData.closingCash || 0).toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md bg-gray-50 dark:bg-gray-800 font-semibold"
                step="0.001"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cash Difference</label>
              <input
                type="number"
                value={cashDifference.toFixed(2)}
                readOnly
                className={`w-full px-3 py-2 border rounded-md font-bold ${
                  cashDifference === 0
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-400'
                    : cashDifference > 0
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-400'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-400'
                }`}
              />
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                {cashDifference === 0 ? '✓ Balanced' : cashDifference > 0 ? '↑ Excess' : '↓ Shortage'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {summary && (
        <Card className="mb-4 sm:mb-6">
          <div className="p-3 sm:p-4 lg:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 dark:text-white">Payment Method Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button variant="primary" onClick={handleSubmit} className="w-full sm:w-auto touch-target">
          {existingClosing ? 'Update Closing' : 'Save Closing'}
        </Button>
        {existingClosing && !existingClosing.isFinalized && (
          <Button variant="primary" onClick={handleFinalize} className="w-full sm:w-auto touch-target">
            Finalize Closing
          </Button>
        )}
        {existingClosing && existingClosing.isFinalized && (
          <span className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-md font-semibold text-center touch-target">
            ✓ Finalized
          </span>
        )}
      </div>
    </div>
  );
}

