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
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'amount' | 'orders' | 'name'>('amount');

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

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
          showNotification(`✅ Order ${order.saleNo} fully paid and completed!`, 'success');
        } else {
          showNotification(`Payment of ₹${Math.round(amount)} recorded for order ${order.saleNo}. Remaining: ₹${Math.round(remaining)}`, 'success');
        }
      } else {
        // Pay all pending orders (distribute payment across orders)
        let remainingAmount = amount;
        const ordersToPay = [...selectedCustomer.openOrders].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const completedOrders: string[] = [];
        const partiallyPaidOrders: Array<{ saleNo: string; remaining: number }> = [];

        for (const order of ordersToPay) {
          if (remainingAmount <= 0) break;

          // Use remainingBalance if available (for credit orders), otherwise use pending
          const orderRemaining = order.remainingBalance !== undefined 
            ? order.remainingBalance 
            : order.pending;
          const paymentForThisOrder = Math.min(remainingAmount, orderRemaining);
          
          // Calculate if this order will be fully paid
          const totalPaidBefore = order.totalPaid || 0;
          const totalPaidAfter = totalPaidBefore + paymentForThisOrder;
          const willBeFullyPaid = totalPaidAfter >= order.grandTotal - 0.01;

          await api.post(`/api/v1/sales/${order.id}/pay`, {
            payments: [
              {
                method: paymentMethod,
                amount: Math.round(paymentForThisOrder),
              },
            ],
          });

          if (willBeFullyPaid) {
            completedOrders.push(order.saleNo);
          } else {
            const remaining = order.grandTotal - totalPaidAfter;
            partiallyPaidOrders.push({ saleNo: order.saleNo, remaining: Math.round(remaining) });
          }

          remainingAmount -= paymentForThisOrder;
        }

        // Show success animation
        setSuccessData({
          amount: Math.round(amount),
          customerName: selectedCustomer.name,
        });
        setShowSuccessAnimation(true);

        // Build success message
        let successMessage = `Payment of ₹${Math.round(amount)} processed successfully`;
        if (completedOrders.length > 0) {
          successMessage += `. ${completedOrders.length} order${completedOrders.length > 1 ? 's' : ''} completed: ${completedOrders.join(', ')}`;
        }
        if (partiallyPaidOrders.length > 0 && remainingAmount <= 0) {
          const remainingTotal = partiallyPaidOrders.reduce((sum, o) => sum + o.remaining, 0);
          successMessage += `. ₹${remainingTotal} still pending across ${partiallyPaidOrders.length} order${partiallyPaidOrders.length > 1 ? 's' : ''}`;
        }
        if (remainingAmount > 0) {
          successMessage += `. ₹${Math.round(remainingAmount)} remaining (excess payment)`;
        }

        showNotification(successMessage, 'success');
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

  // Filter and sort customers
  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.openOrders.some(order => order.saleNo.toLowerCase().includes(query))
    );
  }).sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return b.totalPending - a.totalPending;
      case 'orders':
        return b.orderCount - a.orderCount;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  // Calculate summary stats
  const totalPending = customers.reduce((sum, c) => sum + c.totalPending, 0);
  const totalCustomers = customers.length;
  const totalOrders = customers.reduce((sum, c) => sum + c.orderCount, 0);
  const avgPendingPerCustomer = totalCustomers > 0 ? totalPending / totalCustomers : 0;

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

      {/* Search and Filter Bar */}
      {customers.length > 0 && (
        <div className="mb-4 sm:mb-6 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, email, or order number..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'amount' | 'orders' | 'name')}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-medium"
              >
                <option value="amount">Sort by Amount</option>
                <option value="orders">Sort by Orders</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>

            {/* Results count */}
            {searchQuery && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Found {filteredCustomers.length} of {customers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {customers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 flex-shrink-0">
          {/* Total Pending */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-white/80 text-xs sm:text-sm font-medium mb-1">Total Pending</p>
            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">
              ₹{Math.round(totalPending).toLocaleString()}
            </p>
          </div>

          {/* Total Customers */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <p className="text-white/80 text-xs sm:text-sm font-medium mb-1">Customers</p>
            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{totalCustomers}</p>
          </div>

          {/* Total Orders */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-white/80 text-xs sm:text-sm font-medium mb-1">Pending Orders</p>
            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{totalOrders}</p>
          </div>

          {/* Average Per Customer */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-white/80 text-xs sm:text-sm font-medium mb-1">Avg. Per Customer</p>
            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">
              ₹{Math.round(avgPendingPerCustomer).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Customers List */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700">
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredCustomers.length === 0 && customers.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full mb-4 animate-scale-in">
                <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg mb-1">No pending payments</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">All customers are up to date</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg mb-1">No customers found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Try adjusting your search criteria</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCustomers.map((customer, index) => {
                const isExpanded = expandedCustomers.has(customer.id);
                const daysSinceOldest = customer.openOrders.length > 0 
                  ? Math.floor((Date.now() - new Date(customer.openOrders[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                const urgencyColor = daysSinceOldest > 30 ? 'red' : daysSinceOldest > 14 ? 'orange' : 'yellow';

                return (
                  <div
                    key={customer.id}
                    className="p-4 sm:p-6 transition-all duration-200 animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Customer Header - Always Visible */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-xl dark:text-white">
                            {customer.name}
                          </h3>
                          <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold border border-red-200 dark:border-red-800">
                            {customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                          {daysSinceOldest > 7 && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              urgencyColor === 'red' 
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                : urgencyColor === 'orange'
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                            }`}>
                              {daysSinceOldest}d old
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{customer.phone}</span>
                          </div>
                          {customer.email && (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="truncate">{customer.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Pending Amount and Actions Row */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xl font-bold text-red-600 dark:text-red-400">
                              ₹{Math.round(customer.totalPending).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleCustomerExpanded(customer.id)}
                              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-semibold text-sm flex items-center gap-2"
                            >
                              {isExpanded ? 'Hide' : 'Show'} Details
                              <svg 
                                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handlePayPending(customer)}
                              className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 font-bold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                            >
                              Pay All
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Orders Section */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3 animate-fade-in-up pl-0 sm:pl-18">
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
                    )}
                  </div>
                );
              })}
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

