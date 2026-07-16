'use client';

import { useState, useCallback, useRef } from 'react';
import { tallyPaymentsFromSales, paymentBreakdownBuckets } from '@azela-pos/shared';
import api from '@/lib/api';
import { localDateRangeToApiBounds, todayLocalYmd, defaultDateRangeLast7Days } from '@/lib/dateRangeParams';
import { format, subDays, parseISO } from 'date-fns';

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
    async (userRole: string) => {
      const todayYmd = todayLocalYmd();
      const { startDate, endDate } = localDateRangeToApiBounds(todayYmd, todayYmd);

      const tasks: Promise<void>[] = [
        (async () => {
          try {
            const inventoryRes = await api.get('/api/v1/inventory/ledger', {
              params: { startDate, endDate },
            });
            const ledgers = inventoryRes.data || [];
            const receivedStock = ledgers
              .filter((l: any) => l.type === 'IN' && l.reason === 'RECEIVE')
              .reduce((s: number, l: any) => s + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
            const soldStock = ledgers
              .filter((l: any) => l.type === 'OUT' && l.reason === 'SALE')
              .reduce((s: number, l: any) => s + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
            setStats((prev) => {
              if (!prev) return prev;
              const next = {
                ...prev,
                todayStock: {
                  ...prev.todayStock,
                  receivedStock,
                  soldStock,
                },
              };
              statsRef.current = next;
              return next;
            });
          } catch {
            /* ignore secondary */
          }
        })(),
        loadPendingPayments(),
      ];

      if (userRole === 'MANAGER' || userRole === 'OWNER') {
        tasks.push(
          (async () => {
            try {
              const topItemsRes = await api.get(
                '/api/v1/analytics/top-items?startDate=' + defaultDateRangeLast7Days().start
              );
              const topItems = topItemsRes.data || [];
              setStats((prev) => {
                if (!prev) return prev;
                const next = { ...prev, topItems };
                statsRef.current = next;
                return next;
              });
            } catch {
              /* ignore */
            }
          })(),
          (async () => {
            try {
              const trendStartYmd = format(subDays(parseISO(todayYmd), 6), 'yyyy-MM-dd');
              const res = await api.get('/api/v1/analytics/sales-trend', {
                params: { startDate: trendStartYmd, endDate: todayYmd },
              });
              setSalesTrendLast7(Array.isArray(res?.data) ? res.data : []);
            } catch {
              setSalesTrendLast7([]);
            }
          })()
        );
      } else {
        setSalesTrendLast7([]);
      }

      await Promise.all(tasks);
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
          todayStock: light ? statsRef.current!.todayStock : emptyStock,
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
        } else {
          void loadPendingPayments();
        }
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
