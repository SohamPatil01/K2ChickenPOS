'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function RoyaltyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [calculateForm, setCalculateForm] = useState({
    franchiseConfigId: '',
    periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
  });
  const [franchiseConfigs, setFranchiseConfigs] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, selectedStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, configsRes] = await Promise.all([
        api.get('/api/v1/hq/royalty/invoices', { params: { status: selectedStatus || undefined } }),
        api.get('/api/v1/hq/franchises/config'),
      ]);
      setInvoices(invoicesRes.data);
      setFranchiseConfigs(configsRes.data);
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!calculateForm.franchiseConfigId) {
      alert('Please select a franchise');
      return;
    }
    try {
      await api.post('/api/v1/hq/royalty/calculate', calculateForm);
      setShowCalculateModal(false);
      await loadData();
      alert('Royalty calculated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to calculate royalty');
    }
  };

  const handleMarkInvoiced = async (id: string) => {
    try {
      await api.patch(`/api/v1/hq/royalty/invoices/${id}/invoice`);
      await loadData();
      alert('Invoice marked as invoiced!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update invoice');
    }
  };

  const handleMarkPaid = async (id: string) => {
    const paymentRef = prompt('Enter payment reference:');
    if (paymentRef === null) return;
    try {
      await api.patch(`/api/v1/hq/royalty/invoices/${id}/pay`, { paymentReference: paymentRef });
      await loadData();
      alert('Invoice marked as paid!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update invoice');
    }
  };

  const handleCalculateAll = async () => {
    if (!confirm('Calculate royalties for all franchises? This may take a moment.')) return;
    try {
      const response = await api.post('/api/v1/hq/royalty/calculate-all', {
        periodStart: calculateForm.periodStart,
        periodEnd: calculateForm.periodEnd,
      });
      await loadData();
      alert(`Calculated royalties for ${response.data.successful} franchises`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to calculate all royalties');
    }
  };

  const handleCalculateMonthly = async () => {
    if (!confirm('Calculate monthly royalties for all franchises (previous month)? This may take a moment.')) return;
    try {
      const response = await api.post('/api/v1/hq/royalty/calculate-monthly', {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      await loadData();
      alert(`Calculated monthly royalties: ${response.data.successful} successful, ${response.data.failed} failed`);
      if (response.data.errors.length > 0) {
        console.error('Errors:', response.data.errors);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to calculate monthly royalties');
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);
      
      const response = await api.get('/api/v1/hq/royalty/invoices/export', {
        params: Object.fromEntries(params),
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `royalty-invoices-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to export CSV');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'INVOICED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'CALCULATED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Royalty & Margin Engine</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage royalty calculations and invoices</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCalculateModal(true)}>
              Calculate Royalty
            </Button>
            <Button variant="secondary" onClick={handleCalculateMonthly}>
              Calculate Monthly
            </Button>
            <Button variant="primary" onClick={handleCalculateAll}>
              Calculate All
            </Button>
            <Button variant="secondary" onClick={handleExportCSV}>
              📥 Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CALCULATED">Calculated</option>
            <option value="INVOICED">Invoiced</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>

        {/* Invoices List */}
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id} hasAccent>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold dark:text-white">Invoice #{invoice.invoiceNo}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {invoice.franchiseConfig.franchiseStore.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Period: {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gross Sales</p>
                  <p className="font-semibold dark:text-white">₹{invoice.grossSales.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Net Sales</p>
                  <p className="font-semibold dark:text-white">₹{invoice.netSales.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Base Royalty</p>
                  <p className="font-semibold dark:text-white">₹{invoice.baseRoyalty.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Royalty</p>
                  <p className="font-semibold dark:text-white">₹{invoice.totalRoyalty.toLocaleString()}</p>
                </div>
              </div>

              {(invoice.wastagePenalty > 0 || invoice.pricingViolationPenalty > 0 || invoice.compliancePenalty > 0) && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold dark:text-white mb-2">Penalties:</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {invoice.wastagePenalty > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Wastage:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400 ml-2">₹{invoice.wastagePenalty.toLocaleString()}</span>
                      </div>
                    )}
                    {invoice.pricingViolationPenalty > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Pricing:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400 ml-2">₹{invoice.pricingViolationPenalty.toLocaleString()}</span>
                      </div>
                    )}
                    {invoice.compliancePenalty > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Compliance:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400 ml-2">₹{invoice.compliancePenalty.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                {invoice.status === 'CALCULATED' && (
                  <Button variant="primary" size="sm" onClick={() => handleMarkInvoiced(invoice.id)}>
                    Mark as Invoiced
                  </Button>
                )}
                {invoice.status === 'INVOICED' && (
                  <Button variant="primary" size="sm" onClick={() => handleMarkPaid(invoice.id)}>
                    Mark as Paid
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Print Invoice
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Calculate Modal */}
        {showCalculateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Calculate Royalty</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Franchise *</label>
                  <select
                    value={calculateForm.franchiseConfigId}
                    onChange={(e) => setCalculateForm({ ...calculateForm, franchiseConfigId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select franchise</option>
                    {franchiseConfigs
                      .filter((config) => config.franchiseConfigId) // Only show franchises with config
                      .map((config) => (
                        <option key={config.franchiseConfigId} value={config.franchiseConfigId}>
                          {config.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period Start *</label>
                  <input
                    type="date"
                    value={calculateForm.periodStart}
                    onChange={(e) => setCalculateForm({ ...calculateForm, periodStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period End *</label>
                  <input
                    type="date"
                    value={calculateForm.periodEnd}
                    onChange={(e) => setCalculateForm({ ...calculateForm, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowCalculateModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCalculate} className="flex-1">
                    Calculate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

