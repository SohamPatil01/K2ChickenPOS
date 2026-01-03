'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';
import PaymentSuccessAnimation from '@/components/PaymentSuccessAnimation';

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
    creditAmount?: number;
    pending: number;
    remainingBalance?: number;
    createdAt: string;
    hasCreditPayment?: boolean;
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number; customerName: string; orderNo?: string } | null>(null);

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

        // Show success animation
        setSuccessData({
          amount: Math.round(amount),
          customerName: selectedCustomer.name,
          orderNo: order.saleNo,
        });
        setShowSuccessAnimation(true);

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

        // Show success animation
        setSuccessData({
          amount: Math.round(amount),
          customerName: selectedCustomer.name,
        });
        setShowSuccessAnimation(true);

        showNotification(`Payment of ₹${Math.round(amount)} processed successfully`, 'success');
      }

      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setSelectedOrder(null);
      setPaymentAmount('');
      
      // Reload after animation completes
      setTimeout(() => {
        loadPendingPayments();
      }, 2800);
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
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700">
        <div className="flex-1 overflow-y-auto min-h-0">
          {customers.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full mb-4 animate-scale-in">
                <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg mb-1">No pending payments</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">All customers are up to date</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="p-5 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <h3 className="font-bold text-lg sm:text-xl dark:text-white">
                            {customer.name}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold border border-red-200 dark:border-red-800">
                          {customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>{customer.email}</span>
                          </div>
                        )}
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">
                            Total Pending: ₹{Math.round(customer.totalPending)}
                          </p>
                        </div>
                      </div>

                      {/* Open Orders */}
                      <div className="mt-4 space-y-3">
                        {customer.openOrders.map((order, orderIndex) => {
                          const isCreditOrder = order.hasCreditPayment || false;
                          // For credit orders, remaining balance is grandTotal - actual payments (credit doesn't count)
                          // For regular orders, remaining balance is grandTotal - totalPaid
                          const remainingBalance = order.remainingBalance !== undefined 
                            ? order.remainingBalance 
                            : (isCreditOrder ? order.grandTotal : (order.grandTotal - order.totalPaid));
                          // Calculate paid percent based on actual payments only
                          const actualPaid = order.totalPaid || 0;
                          const paidPercent = order.grandTotal > 0 ? (actualPaid / order.grandTotal) * 100 : 0;
                          return (
                            <div
                              key={order.id}
                              className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-lg transition-all duration-200"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-bold text-sm dark:text-white">
                                      {order.saleNo}
                                    </p>
                                    {isCreditOrder && (
                                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800">
                                        💳 Credit
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(order.createdAt).toLocaleDateString('en-IN', { 
                                      day: 'numeric', 
                                      month: 'short', 
                                      year: 'numeric' 
                                    })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-base font-bold dark:text-white">
                                    ₹{Math.round(order.grandTotal)}
                                  </p>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 mt-1">
                                    {isCreditOrder && order.creditAmount ? (
                                      <>
                                        <p>Credit: ₹{Math.round(order.creditAmount)}</p>
                                        <p>Paid: ₹{Math.round(order.totalPaid)}</p>
                                      </>
                                    ) : (
                                      <p>Paid: ₹{Math.round(order.totalPaid)}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Remaining Balance - Prominently Displayed */}
                              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">Remaining Balance</span>
                                  </div>
                                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                                    ₹{Math.round(remainingBalance)}
                                  </p>
                                </div>
                              </div>

                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mb-3 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                                  style={{ width: `${Math.min(100, paidPercent)}%` }}
                                ></div>
                              </div>
                              <button
                                onClick={() => handlePayPending(customer, order.id)}
                                className="w-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                Pay ₹{Math.round(remainingBalance)}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-[180px]">
                      <button
                        onClick={() => handlePayPending(customer)}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                      >
                        💰 Pay All ₹{Math.round(customer.totalPending)}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Success Animation */}
      {showSuccessAnimation && successData && (
        <PaymentSuccessAnimation
          amount={successData.amount}
          customerName={successData.customerName}
          orderNo={successData.orderNo}
          onComplete={() => {
            setShowSuccessAnimation(false);
            setSuccessData(null);
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  ₹
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Record Payment
                </h2>
              </div>
              
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
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="CARD">💳 Card</option>
                    <option value="UPI">📱 UPI</option>
                    <option value="ONLINE">🌐 Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Payment Amount
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={paymentAmount}
                      readOnly
                      onClick={() => setShowNumPad(true)}
                      className="w-full px-4 py-4 text-2xl border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold cursor-pointer text-center"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNumPad(true)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-semibold transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessPayment}
                  disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:from-brand-600 hover:to-brand-700 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    '✅ Record Payment'
                  )}
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

