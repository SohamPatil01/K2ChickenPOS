'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';

export interface Sale {
  id: string;
  saleNo: string;
  customer: { id: string; name: string; phone: string; area?: string | null } | null;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee?: number;
  deliveryOrder?: { deliveryFee?: number } | null;
  grandTotal: number;
  createdAt: string;
  createdBy: { id?: string; name: string; email?: string; phone?: string };
  items: Array<{
    id: string;
    product: { id: string; name: string; sku: string; unitType: 'KG' | 'PCS' };
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

export interface CashierStats {
  todayRevenue: number;
  todayCount: number;
  todayAvg: number;
}

interface UseCashierSalesOptions {
  user: { id?: string; name?: string; email?: string; phone?: string } | null;
}

export function useCashierSales({ user }: UseCashierSalesOptions) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<CashierStats>({
    todayRevenue: 0,
    todayCount: 0,
    todayAvg: 0,
  });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [salesRes, productsRes] = await Promise.all([
        api.get('/api/v1/sales', {
          params: {
            startDate: today.toISOString(),
            endDate: tomorrow.toISOString(),
          },
        }),
        api.get('/api/v1/products'),
      ]);

      const allSales = salesRes.data || [];
      const cashierSales = allSales.filter((sale: any) => {
        const createdBy = sale.createdBy || {};
        if (createdBy.id && user.id) return createdBy.id === user.id;
        const name = createdBy.name || '';
        return name === user.name || name === user.email || name === user.phone;
      });
      setSales(cashierSales);

      setProducts(productsRes.data || []);

      const paidSales = cashierSales.filter((s: Sale) => s.status === 'PAID');
      const revenue = paidSales.reduce((s: number, x: Sale) => s + x.grandTotal, 0);
      const count = paidSales.length;
      setStats({
        todayRevenue: revenue,
        todayCount: count,
        todayAvg: count > 0 ? revenue / count : 0,
      });
    } catch (e) {
      console.error('[Cashier] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.name, user?.email, user?.phone]);

  return { sales, stats, products, loading, refetch };
}
