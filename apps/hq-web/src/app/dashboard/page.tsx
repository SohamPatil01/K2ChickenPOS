'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface HQDashboard {
  summary: {
    totalFranchises: number;
    totalSales: number;
    totalRevenue: number;
    totalCustomers: number;
    avgRevenuePerFranchise: number;
  };
  franchiseBreakdown: Array<{
    franchiseId: string;
    franchiseName: string;
    sales: number;
    revenue: number;
    customers: number;
    avgBillValue: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<HQDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      router.push('/console');
      return;
    }

    loadDashboard();
    loadFranchises();
  }, [user, router, dateRange]);

  const loadFranchises = async () => {
    try {
      const response = await api.get('/api/v1/stores/franchises/summary');
      setFranchises(response.data || []);
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
    }
  };


  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/dashboard', {
        params: dateRange,
      });
      setDashboard(response.data);
    } catch (error: any) {
      console.error('Failed to load HQ dashboard:', error);
      alert(error.response?.data?.error || 'Failed to load HQ dashboard');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl text-primary-600">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading HQ Dashboard...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Franchise HQ Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and monitor all franchise outlets</p>
          </div>
          <Link
            href="/dashboard/enhanced"
            className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm"
          >
            View Enhanced Dashboard
          </Link>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Overview Content */}
        {dashboard && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Franchises"
                value={dashboard.summary.totalFranchises}
                icon="🏪"
              />
              <StatCard
                title="Total Sales"
                value={dashboard.summary.totalSales}
                subtitle={`${dashboard.summary.totalCustomers} customers`}
                icon="💰"
              />
              <StatCard
                title="Total Revenue"
                value={`₹${dashboard.summary.totalRevenue.toFixed(2)}`}
                subtitle={`Avg: ₹${dashboard.summary.avgRevenuePerFranchise.toFixed(2)} per franchise`}
                icon="📈"
              />
              <StatCard
                title="Total Customers"
                value={dashboard.summary.totalCustomers}
                icon="👥"
              />
            </div>

            {/* Franchise Performance Table */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Franchise Performance</h2>
                <Link href="/franchises" className="text-primary-600 text-sm hover:underline">
                  Manage All →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customers</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Bill</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboard.franchiseBreakdown.map((franchise) => (
                      <tr key={franchise.franchiseId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{franchise.franchiseName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{franchise.sales}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">₹{franchise.revenue.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{franchise.customers}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">₹{franchise.avgBillValue.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/franchises/${franchise.franchiseId}`}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Link href="/franchises" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center">
                <div className="text-3xl mb-2">🏪</div>
                <h3 className="font-semibold">Franchises</h3>
                <p className="text-sm text-gray-500 mt-1">Manage all franchises</p>
              </Link>
              <Link href="/sales" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center">
                <div className="text-3xl mb-2">💰</div>
                <h3 className="font-semibold">Sales</h3>
                <p className="text-sm text-gray-500 mt-1">Monitor sales</p>
              </Link>
              <Link href="/inventory" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="font-semibold">Inventory</h3>
                <p className="text-sm text-gray-500 mt-1">Track inventory</p>
              </Link>
              <Link href="/compliance" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center">
                <div className="text-3xl mb-2">✅</div>
                <h3 className="font-semibold">Compliance</h3>
                <p className="text-sm text-gray-500 mt-1">Check compliance</p>
              </Link>
              <Link href="/payments" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center">
                <div className="text-3xl mb-2">💳</div>
                <h3 className="font-semibold">Payments</h3>
                <p className="text-sm text-gray-500 mt-1">View payments</p>
              </Link>
              <Link href="/analytics" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center">
                <div className="text-3xl mb-2">📈</div>
                <h3 className="font-semibold">Analytics</h3>
                <p className="text-sm text-gray-500 mt-1">View analytics</p>
              </Link>
            </div>
          </>
        )}
      </div>
    </HQLayout>
  );
}

// Sales Monitoring View Component
function SalesMonitoringView({ dateRange }: { dateRange: { startDate: string; endDate: string } }) {
  const [salesData, setSalesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalesData();
  }, [dateRange]);

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/sales-monitoring', {
        params: dateRange,
      });
      setSalesData(response.data);
    } catch (error: any) {
      console.error('Failed to load sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading sales data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Sales Monitoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold">{salesData?.totalSales || 0}</p>
          </div>
          <div className="bg-accent-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Recent Sales (Last 100)</p>
            <p className="text-2xl font-bold">{salesData?.recentSales?.length || 0}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Franchises Active</p>
            <p className="text-2xl font-bold">
              {new Set(salesData?.recentSales?.map((s: any) => s.store?.id) || []).size}
            </p>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4">Recent Sales</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salesData?.recentSales?.slice(0, 20).map((sale: any) => (
                <tr key={sale.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{sale.saleNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{sale.store?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{sale.customer?.name || 'Walk-in'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{sale.items?.length || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{sale.grandTotal.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!salesData?.recentSales || salesData.recentSales.length === 0) && (
          <p className="text-gray-500 text-center py-8">No sales data available</p>
        )}
      </div>
    </div>
  );
}

// Inventory Monitoring View Component
function InventoryMonitoringView() {
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/inventory-monitoring');
      setInventoryData(response.data || []);
    } catch (error: any) {
      console.error('Failed to load inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading inventory data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inventoryData.map((storeInventory) => (
        <div key={storeInventory.storeId} className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{storeInventory.storeName}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {storeInventory.inventory?.slice(0, 20).map((item: any) => (
                  <tr key={item.productId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={item.currentStock === 0 ? 'text-red-600 font-semibold' : ''}>
                        {item.currentStock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!storeInventory.inventory || storeInventory.inventory.length === 0) && (
            <p className="text-gray-500 text-center py-4">No inventory data</p>
          )}
        </div>
      ))}
      {inventoryData.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center">No inventory data available</p>
        </div>
      )}
    </div>
  );
}

// Analytics View Component
function AnalyticsView({ dateRange }: { dateRange: { startDate: string; endDate: string } }) {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [dashboard, topItems] = await Promise.all([
        api.get('/api/v1/hq/dashboard', { params: dateRange }),
        api.get('/api/v1/analytics/top-items', { params: dateRange }),
      ]);
      setAnalyticsData({
        dashboard: dashboard.data,
        topItems: topItems.data || [],
      });
    } catch (error: any) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold">₹{analyticsData?.dashboard?.summary?.totalRevenue.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold">{analyticsData?.dashboard?.summary?.totalSales || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Customers</p>
          <p className="text-2xl font-bold">{analyticsData?.dashboard?.summary?.totalCustomers || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Avg per Franchise</p>
          <p className="text-2xl font-bold">₹{analyticsData?.dashboard?.summary?.avgRevenuePerFranchise.toFixed(2) || '0.00'}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Top Products Across All Franchises</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData?.topItems?.slice(0, 20).map((item: any) => (
                <tr key={item.productId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {item.qtyKg > 0 ? `${item.qtyKg.toFixed(2)} kg` : `${item.qtyPcs} pcs`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{item.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!analyticsData?.topItems || analyticsData.topItems.length === 0) && (
          <p className="text-gray-500 text-center py-8">No analytics data available</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Franchise Performance Comparison</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Bill</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData?.dashboard?.franchiseBreakdown?.map((franchise: any) => (
                <tr key={franchise.franchiseId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{franchise.franchiseName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{franchise.sales}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{franchise.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{franchise.customers}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">₹{franchise.avgBillValue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Compliance View Component
function ComplianceView() {
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompliance();
  }, []);

  const loadCompliance = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/compliance');
      setCompliance(response.data || []);
    } catch (error: any) {
      console.error('Failed to load compliance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading compliance data...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checks</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {compliance.map((item) => (
            <tr key={item.franchiseId}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.franchiseName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">{item.complianceScore}%</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    item.status === 'COMPLIANT'
                      ? 'bg-accent-100 text-accent-800'
                      : item.status === 'WARNING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <div className="flex gap-2">
                  {item.checks.hasUsers && <span className="text-accent-600">✓ Users</span>}
                  {item.checks.hasManager && <span className="text-accent-600">✓ Manager</span>}
                  {item.checks.hasCashier && <span className="text-accent-600">✓ Cashier</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Payments View Component
function PaymentsView({ dateRange }: { dateRange: { startDate: string; endDate: string } }) {
  const [payments, setPayments] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, [dateRange]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/payments-commissions', {
        params: dateRange,
      });
      setPayments(response.data);
    } catch (error: any) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading payments data...</p>;
  }

  if (!payments) {
    return <p className="text-gray-500">No payment data available</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-primary-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold">₹{payments.summary.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Commission ({payments.summary.commissionRate}%)</p>
          <p className="text-2xl font-bold">₹{payments.summary.totalCommission.toFixed(2)}</p>
        </div>
        <div className="bg-accent-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Net Payment</p>
          <p className="text-2xl font-bold">₹{payments.summary.totalNetPayment.toFixed(2)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Payment</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.franchisePayments.map((item: any) => (
              <tr key={item.franchiseId}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.franchiseName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">₹{item.totalRevenue.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">₹{item.commission.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{item.netPayment.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

