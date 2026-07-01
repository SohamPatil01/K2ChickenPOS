'use client';

import { useState, useCallback } from 'react';
import { tallyPaymentsFromSales } from '@azela-pos/shared';
import api from '@/lib/api';
import { localDateRangeToApiBounds, parseLocalYmd, todayLocalYmd } from '@/lib/dateRangeParams';
import { format, startOfMonth, subDays } from 'date-fns';

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

export function useDashboardStats({ user }: UseDashboardStatsOptions) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentsTotal, setPendingPaymentsTotal] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [salesTrendLast7, setSalesTrendLast7] = useState<Array<{ date: string; total: number }>>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);

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

  const refetch = useCallback(async () => {
    if (!user?.storeId) return;
    setLoading(true);
    setError(null);
    const userRole = user.role as string;
    try {
      const todayYmd = todayLocalYmd();
      const { startDate, endDate } = localDateRangeToApiBounds(todayYmd, todayYmd);

      const promises: Promise<any>[] = [
        api.get('/api/v1/sales/dashboard').catch(() => ({ data: null })),
      ];
      if (userRole === 'MANAGER' || userRole === 'OWNER') {
        promises.push(
          api.get(
            '/api/v1/analytics/top-items?startDate=' +
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          ).catch(() => ({ data: null }))
        );
      }

      const results = await Promise.all(promises);
      const dashboardData = results[0].data;
      const topItems = results[1]?.data || [];

      const monthStartYmd = format(startOfMonth(parseLocalYmd(todayYmd)), 'yyyy-MM-dd');
      const { startDate: monthStartIso } = localDateRangeToApiBounds(monthStartYmd, todayYmd);
      const monthSalesRes = await api.get('/api/v1/sales', {
        params: { startDate: monthStartIso, endDate, status: 'PAID' },
      }).catch(() => ({ data: [] }));
      const monthSales = monthSalesRes.data || [];
      const monthRevenue = monthSales.reduce((s: number, x: any) => s + (x.grandTotal || 0), 0);

      const yesterdayYmd = format(subDays(parseLocalYmd(todayYmd), 1), 'yyyy-MM-dd');
      const { startDate: yStart, endDate: yEnd } = localDateRangeToApiBounds(
        yesterdayYmd,
        yesterdayYmd
      );
      const yesterdaySalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: yStart,
          endDate: yEnd,
          status: 'PAID',
        },
      }).catch(() => ({ data: [] }));
      const yesterdaySales = yesterdaySalesRes.data || [];
      const yesterdayRevenue = yesterdaySales.reduce((s: number, x: any) => s + (x.grandTotal || 0), 0);

      const lastWeekYmd = format(subDays(parseLocalYmd(todayYmd), 7), 'yyyy-MM-dd');
      const { startDate: lwStart, endDate: lwEnd } = localDateRangeToApiBounds(
        lastWeekYmd,
        lastWeekYmd
      );
      const lastWeekSalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: lwStart,
          endDate: lwEnd,
          status: 'PAID',
        },
      }).catch(() => ({ data: [] }));
      const lastWeekSales = lastWeekSalesRes.data || [];
      const lastWeekRevenue = lastWeekSales.reduce((s: number, x: any) => s + (x.grandTotal || 0), 0);

      const salesRes = await api.get('/api/v1/sales', {
        params: {
          startDate,
          endDate,
          status: 'PAID',
        },
      }).catch(() => ({ data: [] }));
      const paidSales = salesRes.data || [];

      const tallied = tallyPaymentsFromSales(paidSales);
      const paymentBreakdown = {
        cash: tallied.cash,
        upi: tallied.upi,
        card: tallied.card,
        other: tallied.other + tallied.credit,
      };
      const totalPayments = tallied.total;

      const todayRevenue = paidSales.reduce((s: number, x: any) => s + (x.grandTotal || 0), 0);
      const todayWeight = paidSales.reduce((s: number, x: any) => {
        return s + (x.items || []).reduce((is: number, i: any) => is + (i.qtyKg || 0) + (i.qtyPcs || 0), 0);
      }, 0);

      const inventoryRes = await api.get('/api/v1/inventory/ledger', {
        params: { startDate, endDate },
      }).catch(() => ({ data: [] }));
      const ledgers = inventoryRes.data || [];
      const receivedStock = ledgers
        .filter((l: any) => l.type === 'IN' && l.reason === 'RECEIVE')
        .reduce((s: number, l: any) => s + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
      const soldStock = ledgers
        .filter((l: any) => l.type === 'OUT' && l.reason === 'SALE')
        .reduce((s: number, l: any) => s + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
      const productsRes = await api.get('/api/v1/products').catch(() => ({ data: [] }));
      const products = productsRes.data || [];
      const currentStock = products.reduce((s: number, p: any) => s + (p.currentStock || 0), 0);

      const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
      paidSales.forEach((sale: any) => {
        (sale.items || []).forEach((item: any) => {
          const pid = item.productId;
          if (!pid) return;
          const name = item.product?.name ?? 'Unknown';
          const qty = (item.qtyKg ?? 0) || (item.qtyPcs ?? 0);
          const revenue = item.lineTotal ?? 0;
          if (!productSales[pid]) productSales[pid] = { name, qty: 0, revenue: 0 };
          productSales[pid].name = name;
          productSales[pid].qty += qty;
          productSales[pid].revenue += revenue;
        });
      });
      const topProducts = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          qtySold: data.qty,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const newStats: DashboardStats = {
        today: dashboardData?.today ?? {
          revenue: todayRevenue,
          count: paidSales.length,
          avgBill: paidSales.length > 0 ? todayRevenue / paidSales.length : 0,
        },
        yesterday: { revenue: yesterdayRevenue, count: yesterdaySales.length },
        lastWeek: { revenue: lastWeekRevenue, count: lastWeekSales.length },
        month: dashboardData?.month
          ? { revenue: dashboardData.month.revenue || 0, count: dashboardData.month.count || 0 }
          : { revenue: monthRevenue, count: monthSales.length },
        todaySales: {
          count: paidSales.length,
          revenue: todayRevenue,
          weightKg: todayWeight,
        },
        paymentBreakdown: {
          ...paymentBreakdown,
          total: totalPayments,
        },
        todayStock: {
          openingStock: 0,
          receivedStock,
          soldStock,
          currentStock,
        },
        topProducts,
        topItems,
        recentSales: (dashboardData?.recentSales || paidSales.slice(0, 10)).map((s: any) => ({
          id: s.id,
          saleNo: s.saleNo,
          grandTotal: s.grandTotal,
          status: s.status,
          createdAt: s.createdAt,
          customerName: s.customerName || s.customer?.name || 'Walk-in',
          itemCount: s.itemCount ?? s.items?.length ?? 0,
        })),
      };
      setStats(newStats);

      if (userRole === 'MANAGER' || userRole === 'OWNER') {
        const trendStartYmd = format(subDays(parseLocalYmd(todayYmd), 6), 'yyyy-MM-dd');
        api
          .get('/api/v1/analytics/sales-trend', {
            params: {
              startDate: trendStartYmd,
              endDate: todayYmd,
            },
          })
          .then((res: any) => {
            setSalesTrendLast7(Array.isArray(res?.data) ? res.data : []);
          })
          .catch(() => setSalesTrendLast7([]));
      } else {
        setSalesTrendLast7([]);
      }

      await loadPendingPayments();
    } catch (e: any) {
      console.error('[Dashboard] Failed to load:', e);
      setError(e.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user?.storeId, user?.role, loadPendingPayments]);

  const loadHistoricalData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const dateObj = new Date(date + 'T00:00:00.000Z');
      const nextDay = new Date(dateObj);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      const salesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: dateObj.toISOString(),
          endDate: nextDay.toISOString(),
          status: 'PAID',
        },
      });
      const sales = salesRes.data || [];
      const paymentBreakdown = { cash: 0, upi: 0, card: 0, other: 0 };
      sales.forEach((sale: any) => {
        (sale.payments || []).forEach((p: any) => {
          const method = (p.method || '').toUpperCase();
          const amount = p.amount || 0;
          if (method === 'CASH') paymentBreakdown.cash += amount;
          else if (method === 'UPI') paymentBreakdown.upi += amount;
          else if (method === 'CARD' || method === 'CREDIT_CARD' || method === 'DEBIT_CARD')
            paymentBreakdown.card += amount;
          else paymentBreakdown.other += amount;
        });
      });

      const openSalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: dateObj.toISOString(),
          endDate: nextDay.toISOString(),
          status: 'OPEN',
        },
      });
      const openSales = openSalesRes.data || [];
      const pendingAmount = openSales.reduce((s: number, x: any) => s + ((x.grandTotal || 0) - (x.totalPaid || 0)), 0);

      setHistoricalData({
        date,
        salesCount: sales.length,
        totalRevenue: sales.reduce((s: number, x: any) => s + (x.grandTotal || 0), 0),
        paymentBreakdown,
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
