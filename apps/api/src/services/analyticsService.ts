import { prisma } from '@azela-pos/db';

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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function format(date: Date, formatStr: string): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (formatStr === 'yyyy-MM-dd') {
    return `${year}-${month}-${day}`;
  }
  // Add more formats as needed
  return date.toISOString().split('T')[0];
}

/** Calendar day key for analytics: prefer businessDate when set (UTC day), else sale createdAt */
function saleBucketDateKey(sale: { businessDate: Date | null; createdAt: Date }): string {
  if (sale.businessDate) {
    return format(startOfDay(new Date(sale.businessDate)), 'yyyy-MM-dd');
  }
  return format(new Date(sale.createdAt), 'yyyy-MM-dd');
}

function utcDayOfWeekFromYmd(ymd: string): number {
  const parts = ymd.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const d = parts[2]!;
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function envNum(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultVal;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultVal;
}

const OPEN_PO_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'DISPATCHED'] as const;

/**
 * Analytics Service
 * Provides sales forecasting, demand prediction, and inventory recommendations
 * NO DATABASE SCHEMA CHANGES - Uses existing tables only
 */

export class AnalyticsService {
  /**
   * Calculate moving average for forecasting
   */
  private calculateMovingAverage(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(data[i]);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  /**
   * Simple linear regression for trend detection
   */
  private linearRegression(data: number[]): { slope: number; intercept: number } {
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  private getInventoryEconomicsParams() {
    return {
      leadTimeDays: envNum('ANALYTICS_DEFAULT_LEAD_DAYS', 7),
      orderingCost: envNum('ANALYTICS_ORDERING_COST', 100),
      holdingCostPerUnit: envNum('ANALYTICS_HOLDING_COST_PER_UNIT', 5),
    };
  }

  /**
   * OWNER + franchises vs single store; optional franchiseStoreId narrows OWNER to one location.
   */
  async resolveAnalyticsStoreIds(
    userStoreId: string,
    franchiseStoreId?: string | null
  ): Promise<{
    storeIds: string[];
    storeType: string;
    ownerStoreId: string | null;
  }> {
    const store = await prisma.store.findUnique({
      where: { id: userStoreId },
      select: { id: true, type: true, parentOwnerStoreId: true },
    });
    if (!store) {
      throw new Error(`Store with ID ${userStoreId} not found`);
    }

    if (franchiseStoreId) {
      if (franchiseStoreId === store.id) {
        return {
          storeIds: [franchiseStoreId],
          storeType: store.type,
          ownerStoreId: store.type === 'OWNER' ? store.id : store.parentOwnerStoreId,
        };
      }
      if (store.type === 'OWNER') {
        const child = await prisma.store.findFirst({
          where: {
            id: franchiseStoreId,
            type: 'FRANCHISE',
            parentOwnerStoreId: store.id,
          },
          select: { id: true },
        });
        if (!child) {
          throw new Error('Invalid franchiseStoreId for this owner');
        }
        return {
          storeIds: [franchiseStoreId],
          storeType: 'FRANCHISE',
          ownerStoreId: store.id,
        };
      }
      if (store.type === 'FRANCHISE' && franchiseStoreId !== store.id) {
        throw new Error('Franchise users can only query their own store');
      }
    }

    if (store.type === 'OWNER') {
      const franchises = await prisma.store.findMany({
        where: { type: 'FRANCHISE', parentOwnerStoreId: store.id },
        select: { id: true },
      });
      return {
        storeIds: [store.id, ...franchises.map(f => f.id)],
        storeType: 'OWNER',
        ownerStoreId: store.id,
      };
    }

    return {
      storeIds: [store.id],
      storeType: store.type,
      ownerStoreId: store.parentOwnerStoreId,
    };
  }

  /**
   * Open PO pipeline: requested minus received, for statuses not yet fully received.
   */
  private async getInboundOpenQtyByProduct(
    franchiseStoreId: string,
    productIds: string[]
  ): Promise<Record<string, number>> {
    if (productIds.length === 0) return {};
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        franchiseStoreId,
        status: { in: [...OPEN_PO_STATUSES] },
      },
      include: { items: true },
    });
    const map: Record<string, number> = {};
    for (const po of pos) {
      for (const it of po.items) {
        if (!productIds.includes(it.productId)) continue;
        const orderedKg = it.qtyKg ?? 0;
        const orderedPcs = it.qtyPcs ?? 0;
        const recKg = it.receivedQtyKg ?? 0;
        const recPcs = it.receivedQtyPcs ?? 0;
        const pendingKg = Math.max(0, orderedKg - recKg);
        const pendingPcs = Math.max(0, orderedPcs - recPcs);
        const pending = pendingKg > 0 || orderedKg > 0 ? pendingKg : pendingPcs;
        map[it.productId] = (map[it.productId] || 0) + pending;
      }
    }
    return map;
  }

  /**
   * Sales overview aligned with analytics store scope and businessDate bucketing (UTC calendar day).
   */
  async getSalesOverview(
    userStoreId: string,
    rangeStart: Date,
    rangeEnd: Date,
    franchiseStoreId?: string | null
  ): Promise<any> {
    const { storeIds } = await this.resolveAnalyticsStoreIds(userStoreId, franchiseStoreId);
    const start = startOfDay(rangeStart);
    const end = endOfDay(rangeEnd);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const queryStart = subDays(start, 2);
    const queryEnd = addDays(end, 2);

    const sales = await prisma.sale.findMany({
      where: {
        storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
        status: 'PAID',
        OR: [
          { createdAt: { gte: queryStart, lte: queryEnd } },
          { businessDate: { gte: queryStart, lte: queryEnd } },
        ],
      },
      select: {
        grandTotal: true,
        createdAt: true,
        businessDate: true,
        payments: true,
        items: {
          select: {
            lineTotal: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    const inRange = sales.filter(s => {
      const key = saleBucketDateKey(s);
      return key >= startStr && key <= endStr;
    });

    const byDate: Record<string, number> = {};
    const byHour: Record<number, number> = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byDayOfWeek: Record<string, number> = Object.fromEntries(dayNames.map(d => [d, 0]));
    const paymentMap: Record<string, number> = {};
    const productRevenue: Record<string, number> = {};
    let totalRevenue = 0;

    inRange.forEach(sale => {
      const g = sale.grandTotal || 0;
      totalRevenue += g;
      const dateKey = saleBucketDateKey(sale);
      byDate[dateKey] = (byDate[dateKey] || 0) + g;
      const hour = new Date(sale.createdAt).getUTCHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
      const dow = utcDayOfWeekFromYmd(dateKey);
      const dayKey = dayNames[dow] ?? 'Sun';
      byDayOfWeek[dayKey] = (byDayOfWeek[dayKey] || 0) + g;
      sale.payments.forEach(p => {
        const method = p.method || 'Other';
        paymentMap[method] = (paymentMap[method] || 0) + (p.amount || 0);
      });
      sale.items.forEach(item => {
        const name = item.product?.name || 'Unknown';
        productRevenue[name] = (productRevenue[name] || 0) + (item.lineTotal || 0);
      });
    });

    const totalOrders = inRange.length;
    const daysWithSales = Object.keys(byDate).filter(d => (byDate[d] || 0) > 0).length;
    const minDaysRecommended = 14;
    const insufficientHistory = daysWithSales < minDaysRecommended;

    const dailyRevenue: { date: string; total: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const ds = format(cursor, 'yyyy-MM-dd');
      dailyRevenue.push({ date: ds, total: byDate[ds] || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const bestDayEntry = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
    const peakHourEntry = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    const topProducts = Object.entries(productRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const revenueByDayOfWeek = dayNames.map(day => ({ day, value: byDayOfWeek[day] || 0 }));
    const paymentMix = Object.entries(paymentMap).map(([name, value]) => ({ name, value }));

    return {
      storeIds,
      franchiseStoreId: franchiseStoreId || null,
      startDate: startStr,
      endDate: endStr,
      calendarNote: 'Days use businessDate when set, else createdAt; UTC yyyy-MM-dd. Peak hour uses UTC.',
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      bestDay: bestDayEntry ? { date: bestDayEntry[0], revenue: bestDayEntry[1] } : null,
      peakHour: peakHourEntry
        ? { hour: parseInt(peakHourEntry[0], 10), count: peakHourEntry[1], timezone: 'UTC' as const }
        : null,
      dailyRevenue,
      topProducts,
      revenueByDayOfWeek,
      paymentMix,
      insufficientHistory,
      minDaysRecommended,
      daysWithSales,
    };
  }

  /**
   * Sales Forecasting — seasonal (DoW) blend, naive backtest MAPE, prediction bands.
   */
  async forecastSales(
    storeId: string,
    options: {
      forecastDays?: number;
      historyDays?: number;
      franchiseStoreId?: string | null;
    } = {}
  ): Promise<any> {
    try {
      const forecastDays = Math.min(30, Math.max(1, Number(options.forecastDays) || 7));
      const historyDays = Math.min(365, Math.max(14, Number(options.historyDays) || Math.max(90, forecastDays * 4)));

      const { storeIds } = await this.resolveAnalyticsStoreIds(storeId, options.franchiseStoreId ?? null);

      const startDate = startOfDay(subDays(new Date(), historyDays));
      const endDate = endOfDay(new Date());

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
          status: 'PAID',
          OR: [
            { createdAt: { gte: subDays(startDate, 2), lte: addDays(endDate, 2) } },
            { businessDate: { gte: subDays(startDate, 2), lte: addDays(endDate, 2) } },
          ],
        },
        select: {
          grandTotal: true,
          createdAt: true,
          businessDate: true,
        },
      });

      const histStartStr = format(startDate, 'yyyy-MM-dd');
      const histEndStr = format(endDate, 'yyyy-MM-dd');
      const filtered = sales.filter(s => {
        const k = saleBucketDateKey(s);
        return k >= histStartStr && k <= histEndStr;
      });

      const salesByDate: Record<string, number> = {};
      filtered.forEach(sale => {
        const date = saleBucketDateKey(sale);
        salesByDate[date] = (salesByDate[date] || 0) + (sale.grandTotal || 0);
      });

      const dates: string[] = [];
      const values: number[] = [];
      for (let i = historyDays - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dates.push(date);
        values.push(salesByDate[date] || 0);
      }

      const daysWithPositive = values.filter(v => v > 0).length;
      const minDaysRecommended = 14;
      const insufficientHistory = daysWithPositive < minDaysRecommended;

      const ma7 = this.calculateMovingAverage(values, 7);
      const ma30 = this.calculateMovingAverage(values, 30);
      const { slope } = this.linearRegression(values);
      const trend = slope > 0.1 ? 'upward' : slope < -0.1 ? 'downward' : 'stable';

      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const lastMa7 = ma7.length > 0 ? ma7[ma7.length - 1]! : avgValue;
      const baseline = Number.isFinite(lastMa7) ? lastMa7 : avgValue;

      const dowSum: number[] = Array(7).fill(0);
      const dowCount: number[] = Array(7).fill(0);
      for (let i = 0; i < dates.length; i++) {
        const dow = utcDayOfWeekFromYmd(dates[i]!);
        dowSum[dow] += values[i] ?? 0;
        dowCount[dow] += 1;
      }
      const dowAvg = dowSum.map((s, d) => (dowCount[d]! > 0 ? s / dowCount[d]! : avgValue));

      const naiveResiduals: number[] = [];
      for (let t = 1; t < values.length; t++) {
        const pred = values[t - 1] ?? 0;
        const act = values[t] ?? 0;
        naiveResiduals.push(Math.abs(act - pred));
      }
      const tail = naiveResiduals.slice(-14);
      const meanRes =
        tail.length > 0 ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
      const varRes =
        tail.length > 1
          ? tail.reduce((s, r) => s + (r - meanRes) ** 2, 0) / (tail.length - 1)
          : 0;
      const stdRes = Math.sqrt(Math.max(0, varRes));
      const band = 1.96 * stdRes;

      const naiveMapeWindow = 7;
      let mapeSum = 0;
      let mapeN = 0;
      const from = Math.max(1, values.length - naiveMapeWindow);
      for (let t = from; t < values.length; t++) {
        const act = values[t] ?? 0;
        const pred = values[t - 1] ?? 0;
        const denom = Math.max(act, 1);
        mapeSum += Math.abs(act - pred) / denom;
        mapeN += 1;
      }
      const naiveMapePct = mapeN > 0 ? Math.round((mapeSum / mapeN) * 10000) / 100 : null;

      const forecast: Array<{
        date: string;
        predicted: number;
        predictedLow: number;
        predictedHigh: number;
        confidence: string;
      }> = [];

      for (let i = 1; i <= forecastDays; i++) {
        const futureDate = format(addDays(startOfDay(new Date()), i), 'yyyy-MM-dd');
        const trendAdjust = Number.isFinite(slope) ? slope * i : 0;
        const trendPart = baseline + trendAdjust;
        const fdow = utcDayOfWeekFromYmd(futureDate);
        const seasonalPart = dowAvg[fdow] ?? avgValue;
        const rawPredicted = 0.5 * trendPart + 0.5 * seasonalPart;
        const predicted = Math.max(0, Number.isFinite(rawPredicted) ? rawPredicted : baseline);
        const predictedLow = Math.max(0, predicted - band);
        const predictedHigh = predicted + band;
        const confidence = i <= 2 ? 'high' : i <= 5 ? 'medium' : 'low';

        forecast.push({
          date: futureDate,
          predicted: Math.round(predicted * 100) / 100,
          predictedLow: Math.round(predictedLow * 100) / 100,
          predictedHigh: Math.round(predictedHigh * 100) / 100,
          confidence,
        });
      }

      return {
        historical: dates.map((date, i) => ({
          date,
          actual: values[i] ?? 0,
          ma7: ma7[i] ?? 0,
          ma30: ma30[i] ?? 0,
        })),
        forecast,
        trend: trend || 'stable',
        naiveMapePct,
        accuracyNote:
          'naiveMapePct is mean abs % error for a same-day-as-yesterday forecast on the last 7 days (honest baseline). Legacy "accuracy" from MA7 was removed.',
        avgDailySales: Math.round(avgValue * 100) / 100 || 0,
        insufficientHistory,
        minDaysRecommended,
        daysWithPositiveSales: daysWithPositive,
        historyDays,
        forecastDays,
      };
    } catch (error) {
      console.error('[Analytics] Forecasting error:', error);
      throw error;
    }
  }

  /**
   * Demand — ABC by cumulative revenue, category rollups, optional per-store (OWNER).
   */
  async predictDemand(
    storeId: string,
    days: number = 30,
    options: { franchiseStoreId?: string | null; byStore?: boolean } = {}
  ): Promise<any> {
    try {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      const windowDays = Math.min(90, Math.max(7, Number(days) || 30));
      const { storeIds, storeType } = await this.resolveAnalyticsStoreIds(
        storeId,
        options.franchiseStoreId ?? null
      );

      const startDate = startOfDay(subDays(new Date(), windowDays));
      const endDate = endOfDay(new Date());

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
          status: 'PAID',
          OR: [
            { createdAt: { gte: subDays(startDate, 2), lte: addDays(endDate, 2) } },
            { businessDate: { gte: subDays(startDate, 2), lte: addDays(endDate, 2) } },
          ],
        },
        select: {
          id: true,
          storeId: true,
          createdAt: true,
          businessDate: true,
          items: {
            include: {
              product: {
                include: { category: true },
              },
            },
          },
        },
      });

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const inWindow = sales.filter(s => {
        const k = saleBucketDateKey(s);
        return k >= startStr && k <= endStr;
      });

      type Row = {
        productId: string;
        productName: string;
        totalQty: number;
        totalRevenue: number;
        frequency: number;
        avgPerOrder: number;
        abcClass: 'A' | 'B' | 'C';
        trend: string;
        categoryName: string | null;
      };

      const productDemand: Record<string, Row> = {};
      const byStoreDemand: Record<string, Record<string, Row>> = {};
      const categoryRollup: Record<string, { categoryName: string; totalRevenue: number; totalQty: number; lineCount: number }> = {};

      const ensureRow = (
        map: Record<string, Row>,
        item: { productId: string; lineTotal: number | null; qtyKg: number | null; qtyPcs: number | null; product: any }
      ): Row => {
        const key = item.productId;
        if (!map[key]) {
          map[key] = {
            productId: item.productId,
            productName: item.product?.name || 'Unknown',
            totalQty: 0,
            totalRevenue: 0,
            frequency: 0,
            avgPerOrder: 0,
            abcClass: 'C',
            trend: 'stable',
            categoryName: item.product?.category?.name ?? null,
          };
        }
        return map[key]!;
      };

      inWindow.forEach(sale => {
        const sid = sale.storeId;
        if (options.byStore && storeType === 'OWNER' && !options.franchiseStoreId) {
          if (!byStoreDemand[sid]) byStoreDemand[sid] = {};
        }
        sale.items.forEach(item => {
          const targetMap =
            options.byStore && storeType === 'OWNER' && !options.franchiseStoreId
              ? (byStoreDemand[sid] ??= {})
              : productDemand;
          const row = ensureRow(targetMap, item);
          const qty = item.qtyKg || item.qtyPcs || 0;
          row.totalQty += qty;
          row.totalRevenue += item.lineTotal || 0;
          row.frequency += 1;

          const cat = item.product?.category?.name || 'Uncategorized';
          if (!categoryRollup[cat]) {
            categoryRollup[cat] = { categoryName: cat, totalRevenue: 0, totalQty: 0, lineCount: 0 };
          }
          categoryRollup[cat].totalRevenue += item.lineTotal || 0;
          categoryRollup[cat].totalQty += qty;
          categoryRollup[cat].lineCount += 1;
        });
      });

      const assignAbc = (rows: Row[]) => {
        rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
        const totalRev = rows.reduce((s, r) => s + r.totalRevenue, 0);
        let cum = 0;
        rows.forEach(r => {
          if (totalRev <= 0) {
            r.abcClass = 'C';
            r.trend = 'slow-moving';
            r.avgPerOrder = r.frequency > 0 ? r.totalQty / r.frequency : 0;
            return;
          }
          const startShare = cum / totalRev;
          cum += r.totalRevenue;
          if (startShare < 0.7) r.abcClass = 'A';
          else if (startShare < 0.9) r.abcClass = 'B';
          else r.abcClass = 'C';
          r.trend =
            r.abcClass === 'A' ? 'fast-moving' : r.abcClass === 'C' ? 'slow-moving' : 'medium-moving';
          r.avgPerOrder = r.frequency > 0 ? r.totalQty / r.frequency : 0;
        });
      };

      const aggregateRows = Object.values(productDemand);
      assignAbc(aggregateRows);

      Object.keys(byStoreDemand).forEach(sid => {
        assignAbc(Object.values(byStoreDemand[sid]!));
      });

      aggregateRows.sort((a, b) => b.totalRevenue - a.totalRevenue);

      const hourlyDemand: Record<number, number> = {};
      inWindow.forEach(sale => {
        const hour = new Date(sale.createdAt).getUTCHours();
        hourlyDemand[hour] = (hourlyDemand[hour] || 0) + 1;
      });
      const peakHour = Object.entries(hourlyDemand).sort((a, b) => b[1] - a[1])[0];

      const weeklyDemand: Record<number, number> = {};
      inWindow.forEach(sale => {
        const day = utcDayOfWeekFromYmd(saleBucketDateKey(sale));
        weeklyDemand[day] = (weeklyDemand[day] || 0) + 1;
      });
      const peakDay = Object.entries(weeklyDemand).sort((a, b) => b[1] - a[1])[0];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const fastMoving = aggregateRows.filter(p => p.abcClass === 'A').slice(0, 10);
      const slowMoving = aggregateRows
        .filter(p => p.abcClass === 'C')
        .sort((a, b) => a.totalRevenue - b.totalRevenue)
        .slice(0, 10);

      const categories = Object.values(categoryRollup).sort((a, b) => b.totalRevenue - a.totalRevenue);

      const storeMeta = await prisma.store.findMany({
        where: { id: { in: Object.keys(byStoreDemand) } },
        select: { id: true, name: true },
      });
      const nameById = Object.fromEntries(storeMeta.map(s => [s.id, s.name]));

      const byStorePayload =
        options.byStore && storeType === 'OWNER' && !options.franchiseStoreId
          ? Object.entries(byStoreDemand).map(([sid, pmap]) => ({
              storeId: sid,
              storeName: nameById[sid] || sid,
              products: Object.values(pmap).sort((a, b) => b.totalRevenue - a.totalRevenue),
            }))
          : undefined;

      return {
        products: aggregateRows,
        abcSummary: {
          A: aggregateRows.filter(p => p.abcClass === 'A').length,
          B: aggregateRows.filter(p => p.abcClass === 'B').length,
          C: aggregateRows.filter(p => p.abcClass === 'C').length,
          note: 'A/B/C by cumulative revenue share (~70% / ~20% / ~10% of revenue when sorted by revenue).',
        },
        fastMoving,
        slowMoving,
        categories,
        byStore: byStorePayload,
        peakHour: peakHour
          ? { hour: parseInt(peakHour[0], 10), count: peakHour[1], timezone: 'UTC' as const }
          : null,
        peakDay: peakDay
          ? { day: dayNames[parseInt(peakDay[0], 10)] ?? 'Sunday', count: peakDay[1] }
          : null,
        days: windowDays,
      };
    } catch (error) {
      console.error('[Analytics] Demand prediction error:', error);
      throw error;
    }
  }

  /**
   * Per-location inventory recommendations (EOQ, lead time from env, open PO pipeline).
   */
  private async buildInventoryRecsForLocation(
    targetStoreId: string,
    storeLabel: string,
    ownerStoreId: string,
    historyDays: number
  ): Promise<{ recommendations: any[]; outOfStock: number; lowStock: number; overstock: number }> {
    const { leadTimeDays, orderingCost, holdingCostPerUnit } = this.getInventoryEconomicsParams();
    const startHist = startOfDay(subDays(new Date(), historyDays));
    const endHist = endOfDay(new Date());
    const startStr = format(startHist, 'yyyy-MM-dd');
    const endStr = format(endHist, 'yyyy-MM-dd');

    const products = await prisma.product.findMany({
      where: { ownerStoreId, isActive: true },
      select: { id: true, name: true, sku: true, unitType: true },
    });

    const inboundMap = await this.getInboundOpenQtyByProduct(
      targetStoreId,
      products.map(p => p.id)
    );

    const recommendations: any[] = [];

    for (const product of products) {
      const ledgers = await prisma.inventoryLedger.findMany({
        where: { storeId: targetStoreId, productId: product.id },
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

      const saleItems = await prisma.saleItem.findMany({
        where: {
          productId: product.id,
          sale: {
            storeId: targetStoreId,
            status: 'PAID',
            OR: [
              { createdAt: { gte: subDays(startHist, 2), lte: addDays(endHist, 2) } },
              { businessDate: { gte: subDays(startHist, 2), lte: addDays(endHist, 2) } },
            ],
          },
        },
        include: {
          sale: { select: { createdAt: true, businessDate: true } },
        },
      });

      const totalSold = saleItems
        .filter(si => {
          const k = saleBucketDateKey(si.sale);
          return k >= startStr && k <= endStr;
        })
        .reduce((sum, item) => sum + (item.qtyKg || item.qtyPcs || 0), 0);

      const avgDailySales = historyDays > 0 ? totalSold / historyDays : 0;
      const safetyStock = avgDailySales * 3;
      const reorderPoint = avgDailySales * leadTimeDays + safetyStock;
      const annualDemand = avgDailySales * 365;
      const hc = Math.max(holdingCostPerUnit, 0.0001);
      const eoq =
        annualDemand > 0
          ? Math.sqrt((2 * annualDemand * Math.max(orderingCost, 0)) / hc)
          : 0;

      const inboundOpen = inboundMap[product.id] || 0;
      const effectiveCover = currentStock + inboundOpen;

      let status = 'adequate';
      let action = 'none';
      let suggestedOrderQty = 0;

      if (currentStock <= 0) {
        status = 'out-of-stock';
        action = 'order-urgent';
        suggestedOrderQty = Math.max(Math.ceil(eoq), Math.ceil(reorderPoint - effectiveCover));
      } else if (effectiveCover < reorderPoint) {
        status = 'low-stock';
        action = 'order-soon';
        suggestedOrderQty = Math.max(0, Math.ceil(eoq - effectiveCover));
      } else if (currentStock > eoq * 2 && eoq > 0) {
        status = 'overstock';
        action = 'reduce-orders';
      }

      if (status !== 'adequate') {
        recommendations.push({
          storeId: targetStoreId,
          storeName: storeLabel,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitType: product.unitType,
          currentStock: Math.round(currentStock * 100) / 100,
          inboundOpenQty: Math.round(inboundOpen * 100) / 100,
          effectiveCover: Math.round(effectiveCover * 100) / 100,
          reorderPoint: Math.round(reorderPoint * 100) / 100,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          suggestedOrderQty: Math.round(suggestedOrderQty * 100) / 100,
          status,
          action,
        });
      }
    }

    const urgencyOrder = { 'out-of-stock': 0, 'low-stock': 1, overstock: 2 };
    recommendations.sort(
      (a, b) =>
        urgencyOrder[a.status as keyof typeof urgencyOrder] -
        urgencyOrder[b.status as keyof typeof urgencyOrder]
    );

    return {
      recommendations,
      outOfStock: recommendations.filter(r => r.status === 'out-of-stock').length,
      lowStock: recommendations.filter(r => r.status === 'low-stock').length,
      overstock: recommendations.filter(r => r.status === 'overstock').length,
    };
  }

  /**
   * Inventory recommendations — OWNER sees all locations unless franchiseStoreId is set.
   */
  async getInventoryRecommendations(
    storeId: string,
    options: { franchiseStoreId?: string | null; historyDays?: number } = {}
  ): Promise<any> {
    try {
      const historyDays = Math.min(90, Math.max(7, Number(options.historyDays) || 30));
      const { storeIds, storeType } = await this.resolveAnalyticsStoreIds(
        storeId,
        options.franchiseStoreId ?? null
      );

      const userStore = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true, name: true },
      });
      if (!userStore) {
        return {
          mode: 'single',
          recommendations: [],
          stores: [],
          outOfStock: 0,
          lowStock: 0,
          overstock: 0,
          historyDays,
        };
      }

      const resolvedOwner =
        userStore.type === 'OWNER'
          ? userStore.id
          : userStore.parentOwnerStoreId;
      if (!resolvedOwner) {
        return {
          mode: 'single',
          recommendations: [],
          stores: [],
          outOfStock: 0,
          lowStock: 0,
          overstock: 0,
          historyDays,
        };
      }

      const storesMeta = await prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: { id: true, name: true },
      });
      const nameById = Object.fromEntries(storesMeta.map(s => [s.id, s.name]));

      const multi = storeType === 'OWNER' && storeIds.length > 1 && !options.franchiseStoreId;
      const { leadTimeDays, orderingCost, holdingCostPerUnit } = this.getInventoryEconomicsParams();

      if (!multi) {
        const locId = storeIds[0]!;
        const block = await this.buildInventoryRecsForLocation(
          locId,
          nameById[locId] || locId,
          resolvedOwner,
          historyDays
        );
        return {
          mode: 'single',
          storeIds,
          historyDays,
          leadTimeDays,
          orderingCost,
          holdingCostPerUnit,
          ...block,
          stores: [
            {
              storeId: locId,
              storeName: nameById[locId] || locId,
              ...block,
            },
          ],
        };
      }

      const stores: any[] = [];
      let allRecs: any[] = [];
      let outOfStock = 0;
      let lowStock = 0;
      let overstock = 0;

      for (const sid of storeIds) {
        const block = await this.buildInventoryRecsForLocation(
          sid,
          nameById[sid] || sid,
          resolvedOwner,
          historyDays
        );
        stores.push({ storeId: sid, storeName: nameById[sid] || sid, ...block });
        allRecs = allRecs.concat(block.recommendations);
        outOfStock += block.outOfStock;
        lowStock += block.lowStock;
        overstock += block.overstock;
      }

      const urgencyOrder = { 'out-of-stock': 0, 'low-stock': 1, overstock: 2 };
      allRecs.sort(
        (a, b) =>
          urgencyOrder[a.status as keyof typeof urgencyOrder] -
          urgencyOrder[b.status as keyof typeof urgencyOrder]
      );

      return {
        mode: 'multi',
        storeIds,
        historyDays,
        leadTimeDays,
        orderingCost,
        holdingCostPerUnit,
        note: 'Recommendations are per franchise/HQ location. Open PO quantities (not yet received) reduce suggested orders.',
        recommendations: allRecs,
        stores,
        outOfStock,
        lowStock,
        overstock,
      };
    } catch (error) {
      console.error('[Analytics] Inventory recommendations error:', error);
      throw error;
    }
  }

  /**
   * Calculate average cost (on-the-fly, no DB changes)
   */
  async calculateAverageCost(productId: string): Promise<number> {
    try {
      // Get all purchase order items for this product
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: {
          productId,
          po: {
            status: 'CLOSED', // Only finalized POs
          },
        },
        include: {
          po: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Last 10 purchases
      });

      if (poItems.length === 0) {
        return 0;
      }

      // Calculate weighted average
      let totalCost = 0;
      let totalQty = 0;

      poItems.forEach(item => {
        const qty = (item.receivedQtyKg || item.qtyKg || 0) + (item.receivedQtyPcs || item.qtyPcs || 0);
        const rate = item.requestedRate || 0;
        totalCost += qty * rate;
        totalQty += qty;
      });

      return totalQty > 0 ? totalCost / totalQty : 0;
    } catch (error) {
      console.error('[Analytics] Average cost calculation error:', error);
      return 0;
    }
  }

  /**
   * Get Top Selling Items (aligned store scope + businessDate bucket when set)
   */
  async getTopItems(
    storeId: string,
    startDate: Date,
    endDate: Date,
    franchiseStoreId?: string | null
  ): Promise<any[]> {
    try {
      if (!storeId) return [];

      const { storeIds } = await this.resolveAnalyticsStoreIds(storeId, franchiseStoreId ?? null);
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
          status: 'PAID',
          OR: [
            { createdAt: { gte: subDays(start, 2), lte: addDays(end, 2) } },
            { businessDate: { gte: subDays(start, 2), lte: addDays(end, 2) } },
          ],
        },
        select: {
          createdAt: true,
          businessDate: true,
          items: {
            include: { product: true },
          },
        },
      });

      const inRange = sales.filter(s => {
        const k = saleBucketDateKey(s);
        return k >= startStr && k <= endStr;
      });

      const itemStats: Record<string, { name: string; revenue: number; quantity: number; count: number }> = {};

      inRange.forEach(sale => {
        sale.items.forEach(item => {
          const key = item.productId;
          if (!itemStats[key]) {
            itemStats[key] = {
              name: item.product?.name || 'Unknown',
              revenue: 0,
              quantity: 0,
              count: 0,
            };
          }
          itemStats[key].revenue += item.lineTotal || 0;
          itemStats[key].quantity += item.qtyKg || item.qtyPcs || 0;
          itemStats[key].count += 1;
        });
      });

      return Object.values(itemStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    } catch (error) {
      console.error('[Analytics] Top items error:', error);
      return [];
    }
  }

  /**
   * Get Sales Trend (daily breakdown, businessDate bucket when set)
   */
  async getSalesTrend(
    storeId: string,
    startDate: Date,
    endDate: Date,
    franchiseStoreId?: string | null
  ): Promise<any[]> {
    try {
      if (!storeId) return [];

      const { storeIds } = await this.resolveAnalyticsStoreIds(storeId, franchiseStoreId ?? null);
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
          status: 'PAID',
          OR: [
            { createdAt: { gte: subDays(start, 2), lte: addDays(end, 2) } },
            { businessDate: { gte: subDays(start, 2), lte: addDays(end, 2) } },
          ],
        },
        select: {
          grandTotal: true,
          createdAt: true,
          businessDate: true,
        },
      });

      const inRange = sales.filter(s => {
        const k = saleBucketDateKey(s);
        return k >= startStr && k <= endStr;
      });

      const salesByDate: Record<string, { total: number; count: number }> = {};
      inRange.forEach(sale => {
        const date = saleBucketDateKey(sale);
        if (!salesByDate[date]) {
          salesByDate[date] = { total: 0, count: 0 };
        }
        salesByDate[date].total += sale.grandTotal || 0;
        salesByDate[date].count += 1;
      });

      const result: any[] = [];
      const currentDate = new Date(start);
      const endD = new Date(end);

      while (currentDate <= endD) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const data = salesByDate[dateStr] || { total: 0, count: 0 };
        result.push({
          date: dateStr,
          total: data.total,
          count: data.count,
        });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      return result;
    } catch (error) {
      console.error('[Analytics] Sales trend error:', error);
      return [];
    }
  }

  /**
   * Get Payment Mix (businessDate bucket when set)
   */
  async getPaymentMix(
    storeId: string,
    startDate: Date,
    endDate: Date,
    franchiseStoreId?: string | null
  ): Promise<any[]> {
    try {
      if (!storeId) return [];

      const { storeIds } = await this.resolveAnalyticsStoreIds(storeId, franchiseStoreId ?? null);
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
          status: 'PAID',
          OR: [
            { createdAt: { gte: subDays(start, 2), lte: addDays(end, 2) } },
            { businessDate: { gte: subDays(start, 2), lte: addDays(end, 2) } },
          ],
        },
        select: {
          createdAt: true,
          businessDate: true,
          payments: true,
        },
      });

      const inRange = sales.filter(s => {
        const k = saleBucketDateKey(s);
        return k >= startStr && k <= endStr;
      });

      const paymentStats: Record<string, number> = {};
      inRange.forEach(sale => {
        sale.payments.forEach(payment => {
          const method = payment.method || 'Unknown';
          paymentStats[method] = (paymentStats[method] || 0) + (payment.amount || 0);
        });
      });

      return Object.entries(paymentStats).map(([method, amount]) => ({
        name: method,
        total: amount,
      }));
    } catch (error) {
      console.error('[Analytics] Payment mix error:', error);
      return [];
    }
  }

  /**
   * Get Time Heatmap (UTC hour of sale time; businessDate filter for included sales)
   */
  async getTimeHeatmap(
    storeId: string,
    startDate: Date,
    endDate: Date,
    franchiseStoreId?: string | null
  ): Promise<any[]> {
    try {
      if (!storeId) return [];

      const { storeIds } = await this.resolveAnalyticsStoreIds(storeId, franchiseStoreId ?? null);
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeIds[0],
          status: 'PAID',
          OR: [
            { createdAt: { gte: subDays(start, 2), lte: addDays(end, 2) } },
            { businessDate: { gte: subDays(start, 2), lte: addDays(end, 2) } },
          ],
        },
        select: {
          grandTotal: true,
          createdAt: true,
          businessDate: true,
        },
      });

      const inRange = sales.filter(s => {
        const k = saleBucketDateKey(s);
        return k >= startStr && k <= endStr;
      });

      const hourlyStats: Record<number, { hour: number; count: number; revenue: number }> = {};

      inRange.forEach(sale => {
        const hour = new Date(sale.createdAt).getUTCHours();
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { hour, count: 0, revenue: 0 };
        }
        hourlyStats[hour].count += 1;
        hourlyStats[hour].revenue += sale.grandTotal || 0;
      });

      const result: any[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const stats = hourlyStats[hour] || { hour, count: 0, revenue: 0 };
        result.push({
          hour: `${hour}:00`,
          hourUtc: hour,
          count: stats.count,
          total: stats.revenue,
        });
      }
      return result;
    } catch (error) {
      console.error('[Analytics] Time heatmap error:', error);
      return [];
    }
  }

  /**
   * Rule-based insights for dashboards (no ML).
   */
  async getInsights(
    userStoreId: string,
    startDate: Date,
    endDate: Date,
    franchiseStoreId?: string | null
  ): Promise<any> {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    const daySpan = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    );

    const current = await this.getSalesOverview(userStoreId, start, end, franchiseStoreId);
    const priorEnd = subDays(start, 1);
    const priorStart = subDays(priorEnd, daySpan - 1);
    const prior = await this.getSalesOverview(userStoreId, priorStart, priorEnd, franchiseStoreId);

    const revDelta = current.totalRevenue - prior.totalRevenue;
    const revPct =
      prior.totalRevenue > 0 ? (revDelta / prior.totalRevenue) * 100 : null;

    const top3 = current.topProducts.slice(0, 3).reduce((s: number, p: any) => s + p.revenue, 0);
    const conc = current.totalRevenue > 0 ? top3 / current.totalRevenue : 0;

    const payTotal = (mix: { name: string; value: number }[]) =>
      mix.reduce((s, x) => s + x.value, 0);
    const curPay = payTotal(current.paymentMix);
    const priPay = payTotal(prior.paymentMix);
    const cashCur =
      current.paymentMix.find((x: any) => String(x.name).toUpperCase().includes('CASH'))?.value ?? 0;
    const cashPri =
      prior.paymentMix.find((x: any) => String(x.name).toUpperCase().includes('CASH'))?.value ?? 0;
    const cashShareCur = curPay > 0 ? cashCur / curPay : 0;
    const cashSharePri = priPay > 0 ? cashPri / priPay : 0;
    const cashShiftPct =
      cashSharePri > 0
        ? ((cashShareCur - cashSharePri) / cashSharePri) * 100
        : null;

    const insights: Array<{ severity: 'low' | 'medium' | 'high'; title: string; detail: string }> = [];

    if (current.insufficientHistory) {
      insights.push({
        severity: 'low',
        title: 'Limited sales history',
        detail: `${current.daysWithSales} day(s) with sales in range; ${current.minDaysRecommended}+ recommended for steadier analytics.`,
      });
    }

    if (revPct !== null && Number.isFinite(revPct)) {
      insights.push({
        severity: revPct < -10 ? 'high' : revPct < 0 ? 'medium' : 'low',
        title: 'Revenue vs prior period',
        detail: `Revenue is ${revPct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(revPct))}% vs the previous ${daySpan}-day window.`,
      });
    }

    insights.push({
      severity: conc > 0.55 ? 'medium' : 'low',
      title: 'SKU concentration',
      detail: `Top 3 products = ${Math.round(conc * 100)}% of revenue in this range.`,
    });

    if (cashShiftPct !== null && Math.abs(cashShiftPct) > 15 && priPay > 0) {
      insights.push({
        severity: 'low',
        title: 'Payment mix shift',
        detail: `Cash share moved ~${cashShiftPct > 0 ? '+' : ''}${Math.round(cashShiftPct)}% vs prior period.`,
      });
    }

    const inv = await this.getInventoryRecommendations(userStoreId, {
      franchiseStoreId: franchiseStoreId ?? null,
      historyDays: Math.min(30, daySpan + 14),
    });
    if (inv.outOfStock > 0) {
      insights.push({
        severity: 'high',
        title: 'Stockouts',
        detail: `${inv.outOfStock} SKU(s) flagged out of stock in analyzed locations.`,
      });
    }
    if (inv.lowStock > 0) {
      insights.push({
        severity: 'medium',
        title: 'Reorder attention',
        detail: `${inv.lowStock} SKU(s) below reorder point (after open POs).`,
      });
    }

    return {
      insights,
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
        priorStart: format(priorStart, 'yyyy-MM-dd'),
        priorEnd: format(priorEnd, 'yyyy-MM-dd'),
      },
      franchiseStoreId: franchiseStoreId || null,
      storeIds: current.storeIds,
    };
  }
}

export const analyticsService = new AnalyticsService();

