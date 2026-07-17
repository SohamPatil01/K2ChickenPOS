'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function StoreDiscountApprovalsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [pendingOverrides, setPendingOverrides] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
      return;
    }
    loadData();
  }, [user, router, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const response = await api.get('/api/v1/discounts/override/pending');
        setPendingOverrides(response.data);
      } else {
        const response = await api.get('/api/v1/discounts/override/history');
        setHistory(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load discount overrides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/api/v1/discounts/override/${id}/approve`);
      await loadData();
      alert('Discount approved. Complete payment from Orders → Complete Order for that sale.');
    } catch (error: any) {
      console.error('Failed to approve override:', error);
      alert(error.response?.data?.error || 'Failed to approve override');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      await api.patch(`/api/v1/discounts/override/${id}/reject`, {
        rejectionReason: reason || undefined,
      });
      await loadData();
      alert('Discount override rejected');
    } catch (error: any) {
      console.error('Failed to reject override:', error);
      alert(error.response?.data?.error || 'Failed to reject override');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-ink-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      <div className="mb-3 sm:mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink">Discount Approvals</h1>
        <p className="text-xs sm:text-sm text-ink-muted mt-1">Review and approve discount override requests</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-3 sm:mb-4 flex-shrink-0">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm touch-target whitespace-nowrap ${ activeTab === 'pending' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300' }`}
          >
            Pending ({pendingOverrides.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm touch-target whitespace-nowrap ${ activeTab === 'history' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300' }`}
          >
            History
          </button>
        </nav>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingOverrides.length === 0 ? (
            <Card>
              <div className="p-6 text-center">
                <p className="text-ink-muted">No pending discount override requests</p>
              </div>
            </Card>
          ) : (
            pendingOverrides.map((override) => {
              const discountPercent = override.sale.subTotal > 0
                ? (override.overrideDiscount / override.sale.subTotal) * 100
                : 0;
              const originalPercent = override.sale.subTotal > 0
                ? (override.originalDiscount / override.sale.subTotal) * 100
                : 0;

              return (
                <Card key={override.id}>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">Sale #{override.sale.saleNo}</h3>
                        {override.sale.customer && (
                          <p className="text-sm text-ink-secondary">
                            Customer: {override.sale.customer.name} ({override.sale.customer.phone})
                          </p>
                        )}
                        <p className="text-xs text-ink-muted mt-1">
                          Requested by: {override.requester.name} ({override.requester.role}) on{' '}
                          {new Date(override.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                        PENDING
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div>
                        <p className="text-sm text-ink-secondary">Subtotal</p>
                        <p className="font-semibold text-ink">₹{override.sale.subTotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-ink-secondary">Original Discount</p>
                        <p className="font-semibold text-ink">
                          ₹{override.originalDiscount.toFixed(2)} ({originalPercent.toFixed(2)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-ink-secondary">Requested Discount</p>
                        <p className="font-semibold text-brand-600 dark:text-brand-400">
                          ₹{override.overrideDiscount.toFixed(2)} ({discountPercent.toFixed(2)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-ink-secondary">Difference</p>
                        <p className="font-semibold text-red-600 dark:text-red-400">
                          ₹{(override.overrideDiscount - override.originalDiscount).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-semibold text-ink mb-1">Reason:</p>
                      <p className="text-sm text-ink-secondary bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                        {override.reason}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <Button variant="primary" onClick={() => handleApprove(override.id)} className="w-full sm:w-auto touch-target">
                        Approve
                      </Button>
                      <Button variant="danger" onClick={() => handleReject(override.id)} className="w-full sm:w-auto touch-target">
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <div className="p-6 text-center">
                <p className="text-ink-muted">No discount override history</p>
              </div>
            </Card>
          ) : (
            history.map((override) => {
              const discountPercent = override.sale.subTotal > 0
                ? (override.overrideDiscount / override.sale.subTotal) * 100
                : 0;

              return (
                <Card key={override.id}>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">Sale #{override.sale.saleNo}</h3>
                        {override.sale.customer && (
                          <p className="text-sm text-ink-secondary">
                            Customer: {override.sale.customer.name}
                          </p>
                        )}
                        <p className="text-xs text-ink-muted mt-1">
                          Requested by: {override.requester.name} on {new Date(override.createdAt).toLocaleString()}
                        </p>
                        {override.approver && (
                          <p className="text-xs text-ink-muted">
                            {override.status === 'APPROVED' ? 'Approved' : 'Rejected'} by: {override.approver.name} on{' '}
                            {override.approvedAt ? new Date(override.approvedAt).toLocaleString() : ''}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(override.status)}`}>
                        {override.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <p className="text-sm text-ink-secondary">Subtotal</p>
                        <p className="font-semibold text-ink">₹{override.sale.subTotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-ink-secondary">Discount</p>
                        <p className="font-semibold text-ink">
                          ₹{override.overrideDiscount.toFixed(2)} ({discountPercent.toFixed(2)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-ink-secondary">Reason</p>
                        <p className="text-sm text-ink-muted">{override.reason}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
      </div>
    </div>
  );
}

