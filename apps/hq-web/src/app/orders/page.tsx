'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface Sale {
  id: string;
  saleNo: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  createdAt: string;
  createdBy: {
    name: string;
  };
  store: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      sku: string;
      unitType: 'KG' | 'PCS';
    };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    txnRef?: string;
  }>;
}

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (user && user.role === 'OWNER') {
      loadSales();
    }
  }, [user, selectedStoreId, dateFilter, statusFilter]);

  const loadSales = async () => {
    setLoading(true);
    try {
      // Use UTC to avoid timezone issues - date strings like "2025-01-06" should be treated as UTC midnight
      const startDate = new Date(dateFilter.startDate + 'T00:00:00.000Z');
      const endDate = new Date(dateFilter.endDate + 'T23:59:59.999Z');

      const params: any = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      // If a specific store is selected, filter by that store
      // Otherwise, OWNER users will see all sales from their stores (handled by API)
      if (selectedStoreId) {
        // Note: The API will filter by storeId based on the authenticated user's storeId
        // For OWNER users, they see all their stores' sales
        // We'll need to filter client-side if needed, or modify API to accept storeId param
      }
      
      const response = await api.get('/api/v1/sales', { params });
      let salesData = response.data || [];
      
      // Filter by selected store if one is selected
      if (selectedStoreId) {
        salesData = salesData.filter((sale: Sale) => sale.store?.id === selectedStoreId);
      }
      
      setSales(salesData);
    } catch (error: any) {
      console.error('Failed to load sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBill = (sale: Sale) => {
    if (sale.status === 'VOID') {
      alert('This bill is already cancelled');
      return;
    }
    if (sale.status !== 'PAID') {
      alert('Only paid bills can be cancelled');
      return;
    }
    setCancellingSale(sale);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancellingSale) return;

    setCancelling(true);
    try {
      await api.post(`/api/v1/sales/${cancellingSale.id}/void`, {
        reason: cancelReason || 'Cancelled by owner',
      });

      showNotification('Bill cancelled successfully', 'success');
      setShowCancelModal(false);
      setCancellingSale(null);
      setCancelReason('');
      loadSales();
      
      window.dispatchEvent(new CustomEvent('sale-deleted', { detail: { saleId: cancellingSale.id } }));
    } catch (error: any) {
      console.error('Failed to cancel bill:', error);
      alert(error.response?.data?.error || 'Failed to cancel bill');
    } finally {
      setCancelling(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    // Simple alert for now - can be replaced with a proper notification system
    alert(message);
  };

  const handleCompleteOrder = async (sale: Sale) => {
    if (sale.status !== 'OPEN') {
      alert('Only open orders can be completed');
      return;
    }

    try {
      const existingPayments = sale.payments || [];
      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      const remainingAmount = Math.round(sale.grandTotal - totalPaid);
      const paymentAmount = remainingAmount <= 0 ? Math.round(sale.grandTotal) : remainingAmount;
      
      await api.post(`/api/v1/sales/${sale.id}/pay`, {
        payments: [
          {
            method: 'CASH',
            amount: paymentAmount,
          },
        ],
      });

      showNotification('Order completed successfully', 'success');
      loadSales();
      
      window.dispatchEvent(new CustomEvent('sale-updated', { detail: { saleId: sale.id } }));
      
      if (selectedSale?.id === sale.id) {
        setSelectedSale(null);
      }
    } catch (error: any) {
      console.error('Failed to complete order:', error);
      alert(error.response?.data?.error || 'Failed to complete order');
    }
  };

  if (loading && sales.length === 0) {
    return (
      <HQLayout selectedStoreId={selectedStoreId} onStoreChange={setSelectedStoreId}>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading orders...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout selectedStoreId={selectedStoreId} onStoreChange={setSelectedStoreId}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Orders</h1>
          <p className="text-sm text-gray-500">View and manage orders for individual stores</p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              >
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="PAID">Paid</option>
                <option value="VOID">Void</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadSales}
                className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-md font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sale No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Store
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {sale.saleNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {sale.store?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {sale.customer?.name || 'Walk-in'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(sale.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          timeZoneName: 'short'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            sale.status === 'PAID'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : sale.status === 'OPEN'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        ₹{Math.round(sale.grandTotal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedSale(sale)}
                            className="text-brand-600 hover:text-brand-800 dark:text-brand-400"
                          >
                            View
                          </button>
                          {sale.status === 'OPEN' && (
                            <button
                              onClick={() => handleCompleteOrder(sale)}
                              className="text-green-600 hover:text-green-800 dark:text-green-400"
                            >
                              Complete
                            </button>
                          )}
                          {sale.status === 'PAID' && (
                            <button
                              onClick={() => handleCancelBill(sale)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sale Details Modal */}
        {selectedSale && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Sale Details - {selectedSale.saleNo}
                </h2>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Store</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedSale.store?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedSale.customer?.name || 'Walk-in'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedSale.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedSale.status === 'PAID'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : selectedSale.status === 'OPEN'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {selectedSale.status}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Items</h3>
                  <div className="space-y-2">
                    {selectedSale.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`} × ₹{item.rate}
                          </p>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">₹{item.lineTotal.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(selectedSale.subTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tax</span>
                      <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(selectedSale.taxTotal)}</span>
                    </div>
                    {selectedSale.discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Discount</span>
                        <span className="font-medium text-red-600 dark:text-red-400">-₹{Math.round(selectedSale.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
                      <span className="text-gray-900 dark:text-white">Grand Total</span>
                      <span className="text-brand-600 dark:text-brand-400">₹{Math.round(selectedSale.grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {selectedSale.payments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payments</h3>
                    <div className="space-y-2">
                      {selectedSale.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{payment.method}</span>
                          <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(payment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && cancellingSale && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cancel Bill</h2>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to cancel bill <strong>{cancellingSale.saleNo}</strong>?
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason (optional)
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    rows={3}
                    placeholder="Enter cancellation reason..."
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellingSale(null);
                    setCancelReason('');
                  }}
                  disabled={cancelling}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

