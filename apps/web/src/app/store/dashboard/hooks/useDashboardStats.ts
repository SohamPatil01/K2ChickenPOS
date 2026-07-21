'use client';

import { useState, useCallback, useRef } from 'react';
import { tallyPaymentsFromSales, paymentBreakdownBuckets } from '@azela-pos/shared';
import api from '@/lib/api';
import { localDateRangeToApiBounds } from '@/lib/dateRangeParams';

export interface DashboardStats {
  today: {
    revenue: number;
    count: number;
    avgBill: number;
  };
  yesterday: { revenue: number; count: number };
  lastWeek: { revenue: number; count: number };
  month: { revenue: number; count: number };
  todaySales: { count: number; revenue: number; weightKg: number };
  paymentBreakdown: {
    cash: number;
    upi: number;
    card: number;
    other: number;
    total: number;
  };
  todayStock: {
    openingStock: number;
    receivedStock: number;
    soldStock: number;
    currentStock: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    qtySold: number;
    revenue: number;
  }>;
  topItems: Array<{
    productId: string;
    name: string;
    imageUrl?: string | null;
    qtyKg: number;
    qtyPcs: number;
    revenue: number;
    count: number;
  }>;
  recentSales: Array<{
    id: string;
    saleNo: string;
    grandTotal: number;
    status: string;
    createdAt: string;
    customerName?: string;
    itemCount?: number;
  }>;
}

export interface HistoricalData {
  date: string;
  salesCount: number;
  totalRevenue: number;
  paymentBreakdown: { cash: number; upi: number; card: number; other: number };
  pendingAmount: number;
  pendingCount: number;
}

interface UseDashboardStatsOptions {
  user: { storeId?: string; role?: string } | null;
}

const emptyStock = {
  openingStock: 0,
  receivedStock: 0,
  soldStock: 0,
  currentStock: 0,
};

export function useDashboardStats({ user }: UseDashboardStatsOptions) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentsTotal, setPendingPaymentsTotal] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [salesTrendLast7, setSalesTrendLast7] = useState<Array<{ date: string; total: number }>>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const statsRef = useRef<DashboardStats | null>(null);
  statsRef.current = stats;

  const loadPendingPayments = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/customers/pending-payments');
      const customers = response.data || [];
      const total = customers.reduce((sum: number, c: any) => sum + c.totalPending, 0);
      const count = customers.reduce((sum: number, c: any) => sum + c.orderCount, 0);
      setPendingPaymentsTotal(total);
      setPendingPaymentsCount(count);
    } catch (e) {
      console.error('[Dashboard] Failed to load pending payments:', e);
    }
  }, []);

  const loadSecondary = useCallback(
    async (_userRole: string) => {
      // 5GB Neon budget: only pending totals once — skip ledger dump + analytics fan-out
      // (dashboard already returns topProducts / payment mix).
      await loadPendingPayments();
    },
    [loadPendingPayments]
  );

  const refetch = useCallback(
    async (opts?: { light?: boolean }) => {
      if (!user?.storeId) return;
      const light = opts?.light === true && !!statsRef.current;
      const userRole = user.role as string;
      setLoading(true);
      setError(null);

      try {
        // One fast endpoint replaces month/yesterday/lastWeek/today/products waterfall
        const dashboardRes = await api.get('/api/v1/sales/dashboard');
        const d = dashboardRes.data || {};

        const paymentBreakdown = d.paymentBreakdown || {
          cash: 0,
          upi: 0,
          card: 0,
          other: 0,
          total: 0,
        };

        const core: DashboardStats = {
          today: d.today || { revenue: 0, count: 0, avgBill: 0 },
          yesterday: d.yesterday || { revenue: 0, count: 0 },
          lastWeek: d.lastWeek || { revenue: 0, count: 0 },
          month: d.month || { revenue: 0, count: 0 },
          todaySales: d.todaySales || {
            count: d.today?.count || 0,
            revenue: d.today?.revenue || 0,
            weightKg: 0,
          },
          paymentBreakdown: {
            cash: paymentBreakdown.cash || 0,
            upi: paymentBreakdown.upi || 0,
            card: paymentBreakdown.card || 0,
            other: paymentBreakdown.other || 0,
            total: paymentBreakdown.total || 0,
          },
          todayStock: d.todayStock || emptyStock,
          topProducts: d.topProducts || [],
          topItems: light ? statsRef.current!.topItems : [],
          recentSales: (d.recentSales || []).map((s: any) => ({
            id: s.id,
            saleNo: s.saleNo,
            grandTotal: s.grandTotal,
            status: s.status,
            createdAt: s.createdAt,
            customerName: s.customerName || 'Walk-in',
            itemCount: s.itemCount ?? 0,
          })),
        };

        statsRef.current = core;
        setStats(core);
        setLoading(false);

        if (!light) {
          // Secondary widgets — do not block first paint
          void loadSecondary(userRole);
        }
        // light refresh: skip pending-payments (heavy); sale events trigger full refetch when needed
      } catch (e: any) {
        console.error('[Dashboard] Failed to load:', e);
        setError(e.response?.data?.error || 'Failed to load dashboard');
        setLoading(false);
      }
    },
    [user?.storeId, user?.role, loadPendingPayments, loadSecondary]
  );

  const loadHistoricalData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const { startDate, endDate } = localDateRangeToApiBounds(date, date);

      const [salesRes, openSalesRes] = await Promise.all([
        api.get('/api/v1/sales', {
          params: { startDate, endDate, status: 'PAID' },
        }),
        api.get('/api/v1/sales', {
          params: { startDate, endDate, status: 'OPEN' },
        }),
      ]);
      const sales = salesRes.data || [];
      const { cash, upi, card, other } = paymentBreakdownBuckets(
        tallyPaymentsFromSales(sales)
      );
      const openSales = openSalesRes.data || [];
      const pendingAmount = openSales.reduce(
        (s: number, x: any) => s + ((x.grandTotal || 0) - (x.totalPaid || 0)),
        0
      );

      setHistoricalData({
        date,
        salesCount: sales.length,
        totalRevenue: sales.reduce((s: number, x: any) => s + (x.grandTotal || 0), 0),
        paymentBreakdown: { cash, upi, card, other },
        pendingAmount,
        pendingCount: openSales.length,
      });
    } catch (e) {
      console.error('[Dashboard] Failed to load historical data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    refetch,
    pendingPaymentsTotal,
    pendingPaymentsCount,
    salesTrendLast7,
    historicalData,
    loadHistoricalData,
    loadPendingPayments,
  };
}
