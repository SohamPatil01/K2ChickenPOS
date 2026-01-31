import { PrismaClient } from '@azela-pos/db';

const prisma = new PrismaClient();

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

  /**
   * Sales Forecasting
   * Predicts future sales based on historical data
   */
  async forecastSales(storeId: string, days: number = 7): Promise<any> {
    try {
      console.log('[Analytics] Forecast Sales - Start');
      console.log('[Analytics] StoreId:', storeId);
      console.log('[Analytics] Days:', days);
      
      // Get historical sales data (last 30-90 days)
      const historicalDays = Math.max(30, days * 3);
      const startDate = startOfDay(subDays(new Date(), historicalDays));
      const endDate = endOfDay(new Date());

      console.log('[Analytics] Date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        historicalDays,
      });

      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          grandTotal: true,
          createdAt: true,
        },
      });

      console.log('[Analytics] Found sales:', sales.length);

      // Group by date
      const salesByDate: Record<string, number> = {};
      sales.forEach(sale => {
        const date = format(new Date(sale.createdAt), 'yyyy-MM-dd');
        salesByDate[date] = (salesByDate[date] || 0) + (sale.grandTotal || 0);
      });

      // Create time series
      const dates: string[] = [];
      const values: number[] = [];
      for (let i = historicalDays - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dates.push(date);
        values.push(salesByDate[date] || 0);
      }

      console.log('[Analytics] Time series created:', {
        datesCount: dates.length,
        valuesCount: values.length,
        totalRevenue: values.reduce((a, b) => a + b, 0),
        avgDaily: values.reduce((a, b) => a + b, 0) / values.length,
      });

      // Calculate moving averages
      const ma7 = this.calculateMovingAverage(values, 7);
      const ma30 = this.calculateMovingAverage(values, 30);

      // Detect trend
      const { slope, intercept } = this.linearRegression(values);
      const trend = slope > 0.1 ? 'upward' : slope < -0.1 ? 'downward' : 'stable';

      // Generate forecast
      const forecast: Array<{ date: string; predicted: number; confidence: string }> = [];
      const lastValue = values.length > 0 ? values[values.length - 1] : 0;
      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

      for (let i = 1; i <= days; i++) {
        const futureDate = format(subDays(new Date(), -i), 'yyyy-MM-dd');
        
        // Simple forecast: trend + moving average
        const trendValue = values.length > 0 ? slope * (values.length + i) + intercept : 0;
        const predicted = Math.max(0, (trendValue + avgValue) / 2);
        
        // Confidence decreases with distance
        const confidence = i <= 3 ? 'high' : i <= 7 ? 'medium' : 'low';

        forecast.push({
          date: futureDate,
          predicted: Math.round(predicted * 100) / 100,
          confidence,
        });
      }

      // Calculate accuracy metrics (MAE - Mean Absolute Error)
      const predictions = ma7.slice(-7);
      const actuals = values.slice(-7);
      const mae = predictions.length > 0 && actuals.length > 0
        ? predictions.reduce((sum, pred, i) => sum + Math.abs(pred - (actuals[i] || 0)), 0) / predictions.length 
        : 0;
      const accuracy = avgValue > 0 
        ? Math.max(0, Math.min(100, 100 - (mae / avgValue) * 100))
        : 0;

      const result = {
        historical: dates.map((date, i) => ({
          date,
          actual: values[i] || 0,
          ma7: ma7[i] || 0,
          ma30: ma30[i] || 0,
        })),
        forecast: forecast.length > 0 ? forecast : [],
        trend: trend || 'stable',
        accuracy: Math.round(accuracy) || 0,
        avgDailySales: Math.round(avgValue * 100) / 100 || 0,
      };
      
      // #region agent log
      console.log('[Analytics] Forecast result check:', {
        hasHistorical: !!result.historical,
        historicalCount: result.historical?.length,
        hasForecast: !!result.forecast,
        forecastCount: result.forecast?.length,
        avgDailySales: result.avgDailySales,
        accuracy: result.accuracy,
        trend: result.trend,
        avgDailySalesType: typeof result.avgDailySales,
        avgDailySalesIsNaN: isNaN(result.avgDailySales),
      });
      // #endregion
      
      return result;
    } catch (error) {
      console.error('[Analytics] Forecasting error:', error);
      throw error;
    }
  }

  /**
   * Demand Prediction
   * Identifies product demand patterns
   */
  async predictDemand(storeId: string, days: number = 30): Promise<any> {
    try {
      console.log('[Analytics] Predict Demand - Start');
      console.log('[Analytics] StoreId:', storeId);
      console.log('[Analytics] Days:', days);
      
      if (!storeId) {
        console.error('[Analytics] StoreId is required');
        throw new Error('Store ID is required');
      }

      // Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!store) {
        console.error('[Analytics] Store not found:', storeId);
        throw new Error(`Store with ID ${storeId} not found`);
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [storeId];
      if (store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
        console.log('[Analytics] Owner store - including franchises:', storeIds);
      }
      
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      console.log('[Analytics] Date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        storeIds,
      });

      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });

      console.log('[Analytics] Found sales for demand:', sales.length);

      // Analyze product demand
      const productDemand: Record<string, {
        productId: string;
        productName: string;
        totalQty: number;
        totalRevenue: number;
        frequency: number;
        avgPerOrder: number;
        trend: string;
      }> = {};

      sales.forEach(sale => {
        sale.items.forEach(item => {
          const key = item.productId;
          if (!productDemand[key]) {
            productDemand[key] = {
              productId: item.productId,
              productName: item.product?.name || 'Unknown',
              totalQty: 0,
              totalRevenue: 0,
              frequency: 0,
              avgPerOrder: 0,
              trend: 'stable',
            };
          }

          const qty = item.qtyKg || item.qtyPcs || 0;
          productDemand[key].totalQty += qty;
          productDemand[key].totalRevenue += item.lineTotal || 0;
          productDemand[key].frequency += 1;
        });
      });

      // Calculate averages and classify
      const products = Object.values(productDemand).map(p => {
        p.avgPerOrder = p.frequency > 0 ? p.totalQty / p.frequency : 0;
        p.totalRevenue = p.totalRevenue || 0;
        p.totalQty = p.totalQty || 0;
        
        // Classify as fast/slow moving
        const avgFrequency = days > 0 ? p.frequency / days : 0;
        if (avgFrequency > 2) {
          p.trend = 'fast-moving';
        } else if (avgFrequency < 0.5) {
          p.trend = 'slow-moving';
        }

        return p;
      });

      // Sort by revenue
      products.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Peak hour analysis
      const hourlyDemand: Record<number, number> = {};
      sales.forEach(sale => {
        const hour = new Date(sale.createdAt).getHours();
        hourlyDemand[hour] = (hourlyDemand[hour] || 0) + 1;
      });

      const peakHour = Object.entries(hourlyDemand)
        .sort((a, b) => b[1] - a[1])[0];

      // Day of week analysis
      const weeklyDemand: Record<number, number> = {};
      sales.forEach(sale => {
        const day = new Date(sale.createdAt).getDay();
        weeklyDemand[day] = (weeklyDemand[day] || 0) + 1;
      });

      const peakDay = Object.entries(weeklyDemand)
        .sort((a, b) => b[1] - a[1])[0];

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return {
        products,
        fastMoving: products.filter(p => p.trend === 'fast-moving').slice(0, 10),
        slowMoving: products.filter(p => p.trend === 'slow-moving').slice(0, 10),
        peakHour: peakHour ? { hour: parseInt(peakHour[0]), count: peakHour[1] } : null,
        peakDay: peakDay ? { day: dayNames[parseInt(peakDay[0])], count: peakDay[1] } : null,
      };
    } catch (error) {
      console.error('[Analytics] Demand prediction error:', error);
      throw error;
    }
  }

  /**
   * Inventory Recommendations
   * Suggests reorder points and quantities
   */
  async getInventoryRecommendations(storeId: string): Promise<any> {
    try {
      console.log('[Analytics] Inventory Recommendations - Start');
      console.log('[Analytics] StoreId:', storeId);
      
      // Get the store to determine ownerStoreId
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!store) {
        console.error('[Analytics] Store not found:', storeId);
        return {
          recommendations: [],
          outOfStock: 0,
          lowStock: 0,
          overstock: 0,
        };
      }

      // Determine ownerStoreId - if it's a franchise, use parentOwnerStoreId, otherwise use storeId
      const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
      
      if (!ownerStoreId) {
        console.error('[Analytics] Owner store ID not found for store:', storeId);
        return {
          recommendations: [],
          outOfStock: 0,
          lowStock: 0,
          overstock: 0,
        };
      }

      console.log('[Analytics] OwnerStoreId:', ownerStoreId);
      
      // Get products for this owner store
      const products = await prisma.product.findMany({
        where: {
          ownerStoreId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          unitType: true,
        },
      });

      console.log('[Analytics] Found products:', products.length);

      const recommendations = [];

      for (const product of products) {
        // Get current stock
        const ledgers = await prisma.inventoryLedger.findMany({
          where: {
            storeId,
            productId: product.id,
          },
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

        // Get sales history (last 30 days)
        const sales = await prisma.saleItem.findMany({
          where: {
            productId: product.id,
            sale: {
              storeId,
              status: 'PAID',
              createdAt: {
                gte: subDays(new Date(), 30),
              },
            },
          },
          include: {
            sale: true,
          },
        });

        const totalSold = sales.reduce((sum, item) => sum + (item.qtyKg || item.qtyPcs || 0), 0);
        const avgDailySales = totalSold > 0 ? totalSold / 30 : 0;

        // Calculate reorder point (assuming 7-day lead time)
        const leadTimeDays = 7;
        const safetyStock = avgDailySales * 3; // 3 days safety stock
        const reorderPoint = (avgDailySales * leadTimeDays) + safetyStock;

        // Economic Order Quantity (simplified)
        const annualDemand = avgDailySales * 365;
        const eoq = Math.sqrt((2 * annualDemand * 100) / 5); // Simplified EOQ

        // Determine status
        let status = 'adequate';
        let action = 'none';
        let suggestedOrderQty = 0;

        if (currentStock <= 0) {
          status = 'out-of-stock';
          action = 'order-urgent';
          suggestedOrderQty = Math.ceil(eoq);
        } else if (currentStock < reorderPoint) {
          status = 'low-stock';
          action = 'order-soon';
          suggestedOrderQty = Math.ceil(eoq - currentStock);
        } else if (currentStock > eoq * 2) {
          status = 'overstock';
          action = 'reduce-orders';
        }

        if (status !== 'adequate') {
          recommendations.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitType: product.unitType,
            currentStock: Math.round(currentStock * 100) / 100,
            reorderPoint: Math.round(reorderPoint * 100) / 100,
            avgDailySales: Math.round(avgDailySales * 100) / 100,
            suggestedOrderQty: Math.round(suggestedOrderQty * 100) / 100,
            status,
            action,
          });
        }
      }

      // Sort by urgency
      const urgencyOrder = { 'out-of-stock': 0, 'low-stock': 1, 'overstock': 2 };
      recommendations.sort((a, b) => urgencyOrder[a.status as keyof typeof urgencyOrder] - urgencyOrder[b.status as keyof typeof urgencyOrder]);

      return {
        recommendations,
        outOfStock: recommendations.filter(r => r.status === 'out-of-stock').length,
        lowStock: recommendations.filter(r => r.status === 'low-stock').length,
        overstock: recommendations.filter(r => r.status === 'overstock').length,
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
   * Get Top Selling Items
   */
  async getTopItems(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      console.log('[Analytics] Get Top Items - Start');
      
      if (!storeId) {
        console.error('[Analytics] StoreId is required');
        return [];
      }

      // Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!store) {
        console.error('[Analytics] Store not found:', storeId);
        return [];
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [storeId];
      if (store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
        console.log('[Analytics] Owner store - including franchises:', storeIds);
      }
      
      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      const itemStats: Record<string, { name: string; revenue: number; quantity: number; count: number }> = {};

      sales.forEach(sale => {
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
          itemStats[key].quantity += (item.qtyKg || item.qtyPcs || 0);
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
   * Get Sales Trend (daily breakdown)
   */
  async getSalesTrend(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      console.log('[Analytics] Get Sales Trend - Start');
      console.log('[Analytics] StoreId:', storeId, 'Date range:', startDate, 'to', endDate);
      
      if (!storeId) {
        console.error('[Analytics] StoreId is required');
        return [];
      }

      // Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!store) {
        console.error('[Analytics] Store not found:', storeId);
        return [];
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [storeId];
      if (store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
        console.log('[Analytics] Owner store - including franchises:', storeIds);
      }
      
      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          grandTotal: true,
          createdAt: true,
        },
      });

      console.log('[Analytics] Found sales for trend:', sales.length);

      // Group by date with count and total
      const salesByDate: Record<string, { total: number; count: number }> = {};
      sales.forEach(sale => {
        const date = format(new Date(sale.createdAt), 'yyyy-MM-dd');
        if (!salesByDate[date]) {
          salesByDate[date] = { total: 0, count: 0 };
        }
        salesByDate[date].total += sale.grandTotal || 0;
        salesByDate[date].count += 1;
      });

      // Fill in missing dates with zeros
      const result: any[] = [];
      const currentDate = new Date(startDate);
      const end = new Date(endDate);
      
      while (currentDate <= end) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const data = salesByDate[dateStr] || { total: 0, count: 0 };
        result.push({
          date: dateStr,
          total: data.total,
          count: data.count,
        });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      console.log('[Analytics] Sales trend result:', result.length, 'days');
      return result;
    } catch (error) {
      console.error('[Analytics] Sales trend error:', error);
      return [];
    }
  }

  /**
   * Get Payment Mix
   */
  async getPaymentMix(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      console.log('[Analytics] Get Payment Mix - Start');
      
      if (!storeId) {
        console.error('[Analytics] StoreId is required');
        return [];
      }

      // Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!store) {
        console.error('[Analytics] Store not found:', storeId);
        return [];
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [storeId];
      if (store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
      }
      
      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          payments: true,
        },
      });

      const paymentStats: Record<string, number> = {};
      sales.forEach(sale => {
        sale.payments.forEach(payment => {
          const method = payment.method || 'Unknown';
          paymentStats[method] = (paymentStats[method] || 0) + (payment.amount || 0);
        });
      });

      return Object.entries(paymentStats).map(([method, amount]) => ({ 
        name: method,
        total: amount 
      }));
    } catch (error) {
      console.error('[Analytics] Payment mix error:', error);
      return [];
    }
  }

  /**
   * Get Time Heatmap (hourly and daily patterns)
   */
  async getTimeHeatmap(storeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      console.log('[Analytics] Get Time Heatmap - Start');
      
      if (!storeId) {
        console.error('[Analytics] StoreId is required');
        return [];
      }

      // Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!store) {
        console.error('[Analytics] Store not found:', storeId);
        return [];
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [storeId];
      if (store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
      }
      
      const sales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          grandTotal: true,
          createdAt: true,
        },
      });

      const hourlyStats: Record<number, { hour: number; count: number; revenue: number }> = {};
      
      sales.forEach(sale => {
        const hour = new Date(sale.createdAt).getUTCHours();
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { hour, count: 0, revenue: 0 };
        }
        hourlyStats[hour].count += 1;
        hourlyStats[hour].revenue += sale.grandTotal || 0;
      });

      // Fill in all 24 hours with zeros if needed
      const result: any[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const stats = hourlyStats[hour] || { hour, count: 0, revenue: 0 };
        result.push({
          hour: `${hour}:00`,
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
}

export const analyticsService = new AnalyticsService();

