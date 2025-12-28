import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  categoryId?: string;
}

function getDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    // Parse dates as UTC to avoid timezone issues
    // Date strings like "2025-12-26" are interpreted as UTC midnight
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');
    return {
      gte: start,
      lte: end,
    };
  } else {
    // Default to last 30 days
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);
    start.setUTCHours(0, 0, 0, 0);
    return {
      gte: start,
      lte: end,
    };
  }
}

export async function analyticsRoutes(fastify: FastifyInstance) {

  fastify.get('/sales-trend', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = request.query;
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const userStoreId = queryStoreId || store?.id || '';
    const userRole = 'OWNER'; // Default to owner

    const where: any = {};

    if (userRole === 'OWNER' && queryStoreId) {
      where.storeId = queryStoreId;
    } else {
      where.storeId = userStoreId;
    }

    where.createdAt = getDateRange(startDate, endDate);
    where.status = 'PAID';

    const sales = await prisma.sale.findMany({
      where,
      select: {
        grandTotal: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const grouped = sales.reduce((acc: Record<string, { date: string; total: number; count: number }>, sale) => {
      const date = sale.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, total: 0, count: 0 };
      }
      acc[date].total += sale.grandTotal;
      acc[date].count += 1;
      return acc;
    }, {});

    return Object.values(grouped);
  });

  fastify.get('/top-items', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = request.query;
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const userStoreId = queryStoreId || store?.id || '';
    const userRole = 'OWNER'; // Default to owner

    const where: any = {};

    if (userRole === 'OWNER' && queryStoreId) {
      where.storeId = queryStoreId;
    } else {
      where.storeId = userStoreId;
    }

    where.createdAt = getDateRange(startDate, endDate);
    where.status = 'PAID';

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    const itemStats: Record<string, { name: string; imageUrl: string | null; qtyKg: number; qtyPcs: number; revenue: number; count: number }> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        if (!itemStats[item.productId]) {
          itemStats[item.productId] = {
            name: item.product.name,
            imageUrl: item.product.imageUrl,
            qtyKg: 0,
            qtyPcs: 0,
            revenue: 0,
            count: 0,
          };
        }
        itemStats[item.productId].qtyKg += item.qtyKg || 0;
        itemStats[item.productId].qtyPcs += item.qtyPcs || 0;
        itemStats[item.productId].revenue += item.lineTotal;
        itemStats[item.productId].count += 1;
      }
    }

    return Object.entries(itemStats)
      .map(([productId, stats]) => ({ productId, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  });

  fastify.get('/time-heatmap', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = request.query;
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const userStoreId = queryStoreId || store?.id || '';
    const userRole = 'OWNER'; // Default to owner

    const where: any = {};

    if (userRole === 'OWNER' && queryStoreId) {
      where.storeId = queryStoreId;
    } else {
      where.storeId = userStoreId;
    }

    where.createdAt = getDateRange(startDate, endDate);
    where.status = 'PAID';

    const sales = await prisma.sale.findMany({
      where,
      select: {
        grandTotal: true,
        createdAt: true,
      },
    });

    // Group by hour
    const hourly: Record<number, { hour: number; total: number; count: number }> = {};

    for (const sale of sales) {
      const hour = sale.createdAt.getHours();
      if (!hourly[hour]) {
        hourly[hour] = { hour, total: 0, count: 0 };
      }
      hourly[hour].total += sale.grandTotal;
      hourly[hour].count += 1;
    }

    return Object.values(hourly).sort((a, b) => a.hour - b.hour);
  });

  fastify.get('/payment-mix', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = request.query;
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const userStoreId = queryStoreId || store?.id || '';
    const userRole = 'OWNER'; // Default to owner

    const where: any = {};

    if (userRole === 'OWNER' && queryStoreId) {
      where.storeId = queryStoreId;
    } else {
      where.storeId = userStoreId;
    }

    where.createdAt = getDateRange(startDate, endDate);
    where.status = 'PAID';

    const sales = await prisma.sale.findMany({
      where,
      include: {
        payments: true,
      },
    });

    const paymentStats: Record<string, { method: string; total: number; count: number }> = {};

    for (const sale of sales) {
      for (const payment of sale.payments) {
        if (!paymentStats[payment.method]) {
          paymentStats[payment.method] = {
            method: payment.method,
            total: 0,
            count: 0,
          };
        }
        paymentStats[payment.method].total += payment.amount;
        paymentStats[payment.method].count += 1;
      }
    }

    return Object.values(paymentStats);
  });

  fastify.get('/delivery-kpis', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = request.query;
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const userStoreId = queryStoreId || store?.id || '';
    const userRole = 'OWNER'; // Default to owner

    const where: any = {};

    if (userRole === 'OWNER' && queryStoreId) {
      where.storeId = queryStoreId;
    } else {
      where.storeId = userStoreId;
    }

    where.createdAt = getDateRange(startDate, endDate);

    const deliveries = await prisma.deliveryOrder.findMany({
      where,
      select: {
        status: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    });

    const total = deliveries.length;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const failed = deliveries.filter((d) => d.status === 'FAILED').length;
    const inProgress = deliveries.filter((d) => ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(d.status)).length;

    const deliveredDeliveries = deliveries.filter((d) => d.status === 'DELIVERED' && d.outForDeliveryAt && d.deliveredAt);
    const avgDeliveryTime = deliveredDeliveries.length > 0
      ? deliveredDeliveries.reduce((sum, d) => {
          const time = d.deliveredAt!.getTime() - d.outForDeliveryAt!.getTime();
          return sum + time;
        }, 0) / deliveredDeliveries.length / (1000 * 60) // minutes
      : 0;

    return {
      total,
      delivered,
      failed,
      inProgress,
      successRate: total > 0 ? (delivered / total) * 100 : 0,
      avgDeliveryTimeMinutes: Math.round(avgDeliveryTime),
    };
  });

  fastify.get('/store-compare', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const { startDate, endDate } = request.query;
    const ownerStoreId = request.user!.storeId;

    const ownerStore = await prisma.store.findUnique({
      where: { id: ownerStoreId },
    });

    if (!ownerStore || ownerStore.type !== 'OWNER') {
      reply.code(400).send({ error: 'Not an owner store' });
      return;
    }

    const dateFilter: any = {
      createdAt: getDateRange(startDate, endDate),
      };

    const stores = await prisma.store.findMany({
      where: {
        OR: [
          { id: ownerStoreId },
          { parentOwnerStoreId: ownerStoreId },
        ],
      },
    });

    const storeStats = await Promise.all(
      stores.map(async (store) => {
        const sales = await prisma.sale.findMany({
          where: {
            storeId: store.id,
            status: 'PAID',
            ...dateFilter,
          },
        });

        const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
        const avgBillValue = sales.length > 0 ? totalRevenue / sales.length : 0;

        return {
          storeId: store.id,
          storeName: store.name,
          storeType: store.type,
          totalSales: sales.length,
          totalRevenue,
          avgBillValue,
        };
      })
    );

    return storeStats.sort((a, b) => b.totalRevenue - a.totalRevenue);
  });
}

