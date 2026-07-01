import { prisma } from '@azela-pos/db';
import {
  salesInStoreDayWhere,
  storeDayBoundsFromYmd,
  ymdDaysAgoInStoreTz,
  ymdInStoreTz,
} from '@azela-pos/shared';

// Date utility functions (replacing date-fns to avoid dependency)
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function storeDayRange(ymd: string) {
  return storeDayBoundsFromYmd(ymd);
}

function todayStoreDay() {
  return storeDayRange(ymdInStoreTz());
}

function yesterdayStoreDay() {
  return storeDayRange(ymdDaysAgoInStoreTz(1));
}

/**
 * Alert Service
 * Generates automatic alerts for operational issues
 * NO DATABASE SCHEMA CHANGES - Alerts stored in memory/returned on-demand
 */

export interface Alert {
  id: string;
  type: 'inventory' | 'sales' | 'cash' | 'wastage' | 'performance' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

export class AlertService {
  /**
   * Generate all alerts for a store
   */
  async generateAlerts(storeId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Run all alert checks in parallel
      const [
        inventoryAlerts,
        salesAlerts,
        cashAlerts,
        wastageAlerts,
        performanceAlerts,
      ] = await Promise.all([
        this.checkInventoryAlerts(storeId),
        this.checkSalesAlerts(storeId),
        this.checkCashAlerts(storeId),
        this.checkWastageAlerts(storeId),
        this.checkPerformanceAlerts(storeId),
      ]);

      alerts.push(...inventoryAlerts);
      alerts.push(...salesAlerts);
      alerts.push(...cashAlerts);
      alerts.push(...wastageAlerts);
      alerts.push(...performanceAlerts);

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return alerts;
    } catch (error) {
      console.error('[AlertService] Error generating alerts:', error);
      return alerts;
    }
  }

  /**
   * Inventory Alerts
   */
  private async checkInventoryAlerts(storeId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, sku: true },
      });

      for (const product of products) {
        const ledgers = await prisma.inventoryLedger.findMany({
          where: { storeId, productId: product.id },
          orderBy: { createdAt: 'asc' },
        });

        let currentStock = 0;
        ledgers.forEach(ledger => {
          if (ledger.type === 'IN') {
            currentStock += ledger.qtyKg || ledger.qtyPcs || 0;
          } else {
            currentStock -= ledger.qtyKg || ledger.qtyPcs || 0;
          }
        });

        // Out of stock
        if (currentStock <= 0) {
          alerts.push({
            id: `inv-out-${product.id}`,
            type: 'inventory',
            severity: 'critical',
            title: 'Out of Stock',
            message: `${product.name} is out of stock`,
            timestamp: new Date(),
            data: { productId: product.id, productName: product.name, stock: 0 },
          });
        }
        // Low stock (using simple threshold)
        else if (currentStock < 10) {
          alerts.push({
            id: `inv-low-${product.id}`,
            type: 'inventory',
            severity: 'warning',
            title: 'Low Stock',
            message: `${product.name} is running low (${currentStock.toFixed(2)} remaining)`,
            timestamp: new Date(),
            data: { productId: product.id, productName: product.name, stock: currentStock },
          });
        }
      }
    } catch (error) {
      console.error('[AlertService] Inventory alerts error:', error);
    }

    return alerts;
  }

  /**
   * Sales Alerts
   */
  private async checkSalesAlerts(storeId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      const { gte: today, lte: todayEnd } = todayStoreDay();
      const { gte: yesterday, lte: yesterdayEnd } = yesterdayStoreDay();

      // Today's sales (store calendar day, IST)
      const todaySales = await prisma.sale.findMany({
        where: salesInStoreDayWhere(storeId, ymdInStoreTz(), 'PAID') as any,
      });

      // Yesterday's sales
      const yesterdaySales = await prisma.sale.findMany({
        where: salesInStoreDayWhere(storeId, ymdDaysAgoInStoreTz(1), 'PAID') as any,
      });

      const todayRevenue = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);
      const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + s.grandTotal, 0);

      // No sales today
      if (todaySales.length === 0 && new Date().getHours() > 12) {
        alerts.push({
          id: 'sales-none-today',
          type: 'sales',
          severity: 'warning',
          title: 'No Sales Today',
          message: 'No sales recorded today yet',
          timestamp: new Date(),
        });
      }

      // Significant drop in sales
      if (yesterdayRevenue > 0 && todayRevenue < yesterdayRevenue * 0.5 && new Date().getHours() > 16) {
        const dropPercent = ((yesterdayRevenue - todayRevenue) / yesterdayRevenue * 100).toFixed(0);
        alerts.push({
          id: 'sales-drop',
          type: 'sales',
          severity: 'warning',
          title: 'Sales Drop',
          message: `Sales are down ${dropPercent}% compared to yesterday`,
          timestamp: new Date(),
          data: { todayRevenue, yesterdayRevenue, dropPercent },
        });
      }

      // Check for pending payments
      const pendingPayments = await prisma.sale.findMany({
        where: {
          storeId,
          status: 'OPEN',
        },
        include: {
          customer: true,
          payments: true,
        },
      });

      const totalPending = pendingPayments.reduce((sum, s) => {
        const paid = (s.payments || []).reduce(
          (pSum, p) => pSum + (Number(p.amount) || 0),
          0
        );
        return sum + Math.max(0, (s.grandTotal || 0) - paid);
      }, 0);

      if (totalPending > 10000) {
        alerts.push({
          id: 'sales-pending-high',
          type: 'sales',
          severity: 'warning',
          title: 'High Pending Payments',
          message: `₹${totalPending.toLocaleString()} in pending payments from ${pendingPayments.length} orders`,
          timestamp: new Date(),
          data: { totalPending, count: pendingPayments.length },
        });
      }
    } catch (error) {
      console.error('[AlertService] Sales alerts error:', error);
    }

    return alerts;
  }

  /**
   * Cash Alerts
   */
  private async checkCashAlerts(storeId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      const { gte: today, lte: todayEnd } = todayStoreDay();

      // Get today's closing (if exists) — closingDate key is yyyy-MM-dd UTC midnight
      const closingYmd = ymdInStoreTz();
      const closing = await prisma.dailyClosing.findFirst({
        where: {
          storeId,
          closingDate: new Date(`${closingYmd}T00:00:00.000Z`),
        },
      });

      if (closing) {
        // High cash variance
        const cashVariance = Math.abs(closing.cashDifference || 0);
        const cashVariancePercent = closing.cashExpected > 0 
          ? (cashVariance / closing.cashExpected) * 100 
          : 0;

        if (cashVariancePercent > 5) {
          alerts.push({
            id: 'cash-variance',
            type: 'cash',
            severity: cashVariancePercent > 10 ? 'critical' : 'warning',
            title: 'Cash Variance Detected',
            message: `Cash difference of ₹${cashVariance.toFixed(2)} (${cashVariancePercent.toFixed(1)}%)`,
            timestamp: new Date(),
            data: { variance: cashVariance, percent: cashVariancePercent },
          });
        }

        // High cash sales percentage
        const cashPercent = closing.totalRevenue > 0 
          ? (closing.cashSales / closing.totalRevenue) * 100 
          : 0;

        if (cashPercent > 80) {
          alerts.push({
            id: 'cash-high-percent',
            type: 'cash',
            severity: 'info',
            title: 'High Cash Sales',
            message: `${cashPercent.toFixed(0)}% of sales are in cash`,
            timestamp: new Date(),
            data: { cashPercent },
          });
        }
      }
    } catch (error) {
      console.error('[AlertService] Cash alerts error:', error);
    }

    return alerts;
  }

  /**
   * Wastage Alerts
   */
  private async checkWastageAlerts(storeId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      const { gte: today, lte: todayEnd } = todayStoreDay();

      const wastage = await prisma.inventoryLedger.findMany({
        where: {
          storeId,
          reason: 'WASTAGE',
          createdAt: { gte: today, lte: todayEnd },
        },
        include: {
          product: true,
        },
      });

      const totalWastage = wastage.reduce((sum, w) => sum + (w.qtyKg || w.qtyPcs || 0), 0);

      // Get today's sales for comparison
      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          status: 'PAID',
          createdAt: { gte: today, lte: todayEnd },
        },
        include: {
          items: true,
        },
      });

      const totalSold = sales.reduce((sum, s) => {
        return sum + s.items.reduce((iSum, i) => iSum + (i.qtyKg || i.qtyPcs || 0), 0);
      }, 0);

      // High wastage
      if (totalSold > 0 && totalWastage > totalSold * 0.1) {
        const wastagePercent = ((totalWastage / totalSold) * 100).toFixed(1);
        alerts.push({
          id: 'wastage-high',
          type: 'wastage',
          severity: 'warning',
          title: 'High Wastage',
          message: `Wastage is ${wastagePercent}% of sales today`,
          timestamp: new Date(),
          data: { totalWastage, totalSold, wastagePercent },
        });
      }

      // Wastage for specific products
      wastage.forEach(w => {
        const qty = w.qtyKg || w.qtyPcs || 0;
        if (qty > 5) {
          alerts.push({
            id: `wastage-product-${w.productId}`,
            type: 'wastage',
            severity: 'info',
            title: 'Product Wastage',
            message: `${w.product?.name || 'Unknown'}: ${qty.toFixed(2)} wasted`,
            timestamp: new Date(),
            data: { productId: w.productId, productName: w.product?.name, quantity: qty },
          });
        }
      });
    } catch (error) {
      console.error('[AlertService] Wastage alerts error:', error);
    }

    return alerts;
  }

  /**
   * Performance Alerts
   */
  private async checkPerformanceAlerts(storeId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      const last7StartYmd = ymdDaysAgoInStoreTz(6);
      const { gte: last7Days, lte: todayEnd } = storeDayBoundsFromYmd(last7StartYmd);
      const todayYmd = ymdInStoreTz();
      const { gte: todayStart, lte: todayEndBound } = storeDayBoundsFromYmd(todayYmd);

      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          status: 'PAID',
          OR: [
            { businessDate: { gte: last7Days, lte: todayEndBound } },
            { AND: [{ businessDate: null }, { createdAt: { gte: last7Days, lte: todayEndBound } }] },
          ],
        },
      });

      const avgDailyRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0) / 7;
      const todaySales = sales.filter((s) => {
        const key = s.businessDate
          ? ymdInStoreTz(new Date(s.businessDate))
          : ymdInStoreTz(new Date(s.createdAt));
        return key === todayYmd;
      });
      const todayRevenue = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);

      // Performance below average
      if (avgDailyRevenue > 0 && todayRevenue < avgDailyRevenue * 0.7 && new Date().getHours() > 18) {
        alerts.push({
          id: 'perf-below-avg',
          type: 'performance',
          severity: 'info',
          title: 'Below Average Performance',
          message: `Today's revenue (₹${todayRevenue.toFixed(0)}) is below 7-day average (₹${avgDailyRevenue.toFixed(0)})`,
          timestamp: new Date(),
          data: { todayRevenue, avgRevenue: avgDailyRevenue },
        });
      }

      // Check for unclosed daily closing
      const yesterdayYmd = ymdDaysAgoInStoreTz(1);
      const yesterdayClosing = await prisma.dailyClosing.findFirst({
        where: {
          storeId,
          closingDate: new Date(`${yesterdayYmd}T00:00:00.000Z`),
        },
      });

      if (!yesterdayClosing && new Date().getHours() > 10) {
        alerts.push({
          id: 'perf-no-closing',
          type: 'performance',
          severity: 'warning',
          title: 'Daily Closing Pending',
          message: `Yesterday's daily closing has not been completed`,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('[AlertService] Performance alerts error:', error);
    }

    return alerts;
  }
}

export const alertService = new AlertService();

