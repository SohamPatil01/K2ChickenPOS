'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';

interface CustomerWithPending {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalPending: number;
  orderCount: number;
  openOrders: Array<{
    id: string;
    saleNo: string;
    grandTotal: number;
    totalPaid: number;
    pending: number;
    createdAt: string;
    items: Array<{
      id: string;
      product: {
        id: string;
        name: string;
      };
      qtyKg?: number;
      qtyPcs?: number;
      rate: number;
      lineTotal: number;
    }>;
  }>;
}

export default function PendingPaymentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [customers, setCustomers] = useState<CustomerWithPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithPending | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null); // null = pay all, or specific order ID
  const [processing, setProcessing] = useState(false);
  const [showNumPad, setShowNumPad] = useState(false);

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
      return;
    }

    loadPendingPayments();
  }, [user, router]);

  const loadPendingPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/customers/pending-payments');
      setCustomers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load pending payments:', error);
      showNotification('Failed to load pending payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePayPending = (customer: CustomerWithPending, orderId?: string) => {
    setSelectedCustomer(customer);
    setSelectedOrder(orderId || null);
    const amount = orderId 
      ? customer.openOrders.find(o => o.id === orderId)?.pending || customer.totalPending
      : customer.totalPending;
    setPaymentAmount(amount.toString());
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedCustomer) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotification('Please enter a valid payment amount', 'error');
      return;
    }

    setProcessing(true);
    try {
      if (selectedOrder) {
        // Pay specific order
        const order = selectedCustomer.openOrders.find(o => o.id === selectedOrder);
        if (!order) {
          showNotification('Order not found', 'error');
          return;
        }

        const totalPaid = order.totalPaid + amount;
        const remaining = order.grandTotal - totalPaid;

        // Add payment to the order
        await api.post(`/api/v1/sales/${selectedOrder}/pay`, {
          payments: [
            {
              method: paymentMethod,
              amount: Math.round(amount),
            },
          ],
        });

        // If fully paid, the order will be marked as PAID automatically
        if (remaining <= 0.01) {
          showNotification(`Order ${order.saleNo} fully paid!`, 'success');
        } else {
          showNotification(`Payment of ₹${Math.round(amount)} recorded. Remaining: ₹${Math.round(remaining)}`, 'success');
        }
      } else {
        // Pay all pending orders (distribute payment across orders)
        let remainingAmount = amount;
        const ordersToPay = [...selectedCustomer.openOrders].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const order of ordersToPay) {
          if (remainingAmount <= 0) break;

          const orderPending = order.pending;
          const paymentForThisOrder = Math.min(remainingAmount, orderPending);

          await api.post(`/api/v1/sales/${order.id}/pay`, {
            payments: [
              {
                method: paymentMethod,
                amount: Math.round(paymentForThisOrder),
              },
            ],
          });

          remainingAmount -= paymentForThisOrder;
        }

        showNotification(`Payment of ₹${Math.round(amount)} processed successfully`, 'success');
      }

      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setSelectedOrder(null);
      setPaymentAmount('');
      loadPendingPayments();
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      showNotification(
        error.response?.data?.error || 'Failed to process payment',
        'error'
      );
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading pending payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="mb-3 sm:mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white mb-1 sm:mb-2">
          Pending Payments
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Manage customer credit and pending payments
        </p>
      </div>

      {/* Customers List */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <div className="flex-1 overflow-y-auto min-h-0">
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No pending payments</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">All customers are up to date</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg sm:text-xl dark:text-white">
                          {customer.name}
                        </h3>
                        <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded text-xs font-medium">
                          {customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>Phone: {customer.phone}</p>
                        {customer.email && <p>Email: {customer.email}</p>}
                        <p className="text-base font-semibold text-red-600 dark:text-red-400 mt-2">
                          Total Pending: ₹{Math.round(customer.totalPending)}
                        </p>
                      </div>

                      {/* Open Orders */}
                      <div className="mt-4 space-y-2">
                        {customer.openOrders.map((order) => {
                          const paidPercent = (order.totalPaid / order.grandTotal) * 100;
                          return (
                            <div
                              key={order.id}
                              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium text-sm dark:text-white">
                                    {order.saleNo}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(order.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold dark:text-white">
                                    ₹{Math.round(order.grandTotal)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Paid: ₹{Math.round(order.totalPaid)} | Pending: ₹{Math.round(order.pending)}
                                  </p>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, paidPercent)}%` }}
                                ></div>
                              </div>
                              <button
                                onClick={() => handlePayPending(customer, order.id)}
                                className="w-full px-3 py-1.5 text-xs bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
                              >
                                Pay ₹{Math.round(order.pending)}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full lg:w-auto">
                      <button
                        onClick={() => handlePayPending(customer)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        Pay All (₹{Math.round(customer.totalPending)})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Record Payment
              </h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Customer</p>
                  <p className="font-medium dark:text-white">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCustomer.phone}</p>
                </div>

                {selectedOrder ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Order</p>
                    <p className="font-medium dark:text-white">
                      {selectedCustomer.openOrders.find(o => o.id === selectedOrder)?.saleNo}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Pending: ₹{Math.round(selectedCustomer.openOrders.find(o => o.id === selectedOrder)?.pending || 0)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Pending</p>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                      ₹{Math.round(selectedCustomer.totalPending)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="CARD">💳 Card</option>
                    <option value="UPI">📱 UPI</option>
                    <option value="ONLINE">🌐 Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Amount
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={paymentAmount}
                      readOnly
                      onClick={() => setShowNumPad(true)}
                      className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium cursor-pointer"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNumPad(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedCustomer(null);
                    setSelectedOrder(null);
                    setPaymentAmount('');
                  }}
                  disabled={processing}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessPayment}
                  disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NumPad */}
      {showNumPad && (
        <NumPad
          value={paymentAmount}
          onChange={(value) => setPaymentAmount(value)}
          onClose={() => setShowNumPad(false)}
          onSubmit={() => setShowNumPad(false)}
        />
      )}
    </div>
  );
}

