import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';

function getDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');
    return {
      gte: start,
      lte: end,
    };
  } else {
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

export async function hqAnalyticsRoutes(fastify: FastifyInstance) {
  // Store vs Region comparison
  fastify.get(
    '/analytics/store-comparison',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string } }>, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { startDate, endDate } = request.query;
        const dateFilter = getDateRange(startDate, endDate);

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: {
              include: {
                areaManager: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        });

        const comparison = await Promise.all(
          franchises.map(async (franchise) => {
            const sales = await prisma.sale.findMany({
              where: {
                storeId: franchise.id,
                status: 'PAID',
                createdAt: dateFilter,
              },
            });

            const revenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const salesCount = sales.length;

            // Calculate yield efficiency
            const saleItems = await prisma.saleItem.findMany({
              where: {
                sale: {
                  storeId: franchise.id,
                  status: 'PAID',
                  createdAt: dateFilter,
                },
                product: {
                  unitType: 'KG',
                },
              },
              select: {
                qtyKg: true,
              },
            });

            const soldWeightKg = saleItems.reduce((sum, item) => sum + (item.qtyKg || 0), 0);

            // Get received inventory
            const receivedLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                type: 'IN',
                reason: 'RECEIVE',
                createdAt: dateFilter,
              },
            });

            const receivedWeightKg = receivedLedgers.reduce(
              (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
              0
            );

            const yieldEfficiency = receivedWeightKg > 0 ? (soldWeightKg / receivedWeightKg) * 100 : 0;

            // Calculate wastage
            const wastageLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                reason: 'WASTAGE',
                createdAt: dateFilter,
              },
            });

            const wastageKg = wastageLedgers.reduce(
              (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
              0
            );
            const wastagePercent = receivedWeightKg > 0 ? (wastageKg / receivedWeightKg) * 100 : 0;

            // Calculate discount abuse
            const totalDiscounts = sales.reduce((sum, s) => sum + s.discountTotal, 0);
            const discountPercent = revenue > 0 ? (totalDiscounts / revenue) * 100 : 0;

            const config = franchise.franchiseConfig;
            const allowedDiscountPercent = config?.allowedDiscountPercent || 10.0;
            const discountAbuse = discountPercent > allowedDiscountPercent;

            return {
              franchiseId: franchise.id,
              franchiseName: franchise.name,
              areaManager: config?.areaManager,
              revenue,
              salesCount,
              avgBillValue: salesCount > 0 ? revenue / salesCount : 0,
              yieldEfficiency: Math.round(yieldEfficiency * 100) / 100,
              wastagePercent: Math.round(wastagePercent * 100) / 100,
              discountPercent: Math.round(discountPercent * 100) / 100,
              discountAbuse,
            };
          })
        );

        // Group by area manager (region)
        const regionGroups = comparison.reduce((acc, store) => {
          const regionKey = store.areaManager?.name || 'Unassigned';
          if (!acc[regionKey]) {
            acc[regionKey] = {
              region: regionKey,
              stores: [],
              totalRevenue: 0,
              totalSales: 0,
              avgYieldEfficiency: 0,
              avgWastagePercent: 0,
            };
          }
          acc[regionKey].stores.push(store);
          acc[regionKey].totalRevenue += store.revenue;
          acc[regionKey].totalSales += store.salesCount;
          return acc;
        }, {} as Record<string, any>);

        // Calculate region averages
        Object.values(regionGroups).forEach((region: any) => {
          region.avgYieldEfficiency =
            region.stores.length > 0
              ? region.stores.reduce((sum: number, s: any) => sum + s.yieldEfficiency, 0) / region.stores.length
              : 0;
          region.avgWastagePercent =
            region.stores.length > 0
              ? region.stores.reduce((sum: number, s: any) => sum + s.wastagePercent, 0) / region.stores.length
              : 0;
        });

        return {
          storeComparison: comparison.sort((a, b) => b.revenue - a.revenue),
          regionComparison: Object.values(regionGroups),
        };
      } catch (error: any) {
        console.error('Failed to load store comparison:', error);
        reply.code(500).send({ error: 'Failed to load store comparison' });
      }
    }
  );

  // Yield efficiency leaderboard
  fastify.get(
    '/analytics/yield-leaderboard',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string } }>, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { startDate, endDate } = request.query;
        const dateFilter = getDateRange(startDate, endDate);

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
        });

        const leaderboard = await Promise.all(
          franchises.map(async (franchise) => {
            const saleItems = await prisma.saleItem.findMany({
              where: {
                sale: {
                  storeId: franchise.id,
                  status: 'PAID',
                  createdAt: dateFilter,
                },
                product: {
                  unitType: 'KG',
                },
              },
              select: {
                qtyKg: true,
              },
            });

            const soldWeightKg = saleItems.reduce((sum, item) => sum + (item.qtyKg || 0), 0);

            const receivedLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                type: 'IN',
                reason: 'RECEIVE',
                createdAt: dateFilter,
              },
            });

            const receivedWeightKg = receivedLedgers.reduce(
              (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
              0
            );

            const yieldEfficiency = receivedWeightKg > 0 ? (soldWeightKg / receivedWeightKg) * 100 : 0;

            return {
              franchiseId: franchise.id,
              franchiseName: franchise.name,
              yieldEfficiency: Math.round(yieldEfficiency * 100) / 100,
              soldWeightKg,
              receivedWeightKg,
            };
          })
        );

        return leaderboard.sort((a, b) => b.yieldEfficiency - a.yieldEfficiency);
      } catch (error: any) {
        console.error('Failed to load yield leaderboard:', error);
        reply.code(500).send({ error: 'Failed to load yield leaderboard' });
      }
    }
  );

  // Wastage heatmap
  fastify.get(
    '/analytics/wastage-heatmap',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string } }>, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { startDate, endDate } = request.query;
        const dateFilter = getDateRange(startDate, endDate);

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: true,
          },
        });

        const heatmap = await Promise.all(
          franchises.map(async (franchise) => {
            const receivedLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                type: 'IN',
                reason: 'RECEIVE',
                createdAt: dateFilter,
              },
            });

            const receivedWeightKg = receivedLedgers.reduce(
              (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
              0
            );

            const wastageLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                reason: 'WASTAGE',
                createdAt: dateFilter,
              },
            });

            const wastageKg = wastageLedgers.reduce(
              (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
              0
            );

            const wastagePercent = receivedWeightKg > 0 ? (wastageKg / receivedWeightKg) * 100 : 0;

            const config = franchise.franchiseConfig;
            const allowedWastagePercent = config?.allowedWastagePercent || 5.0;
            const severity =
              wastagePercent > allowedWastagePercent * 2
                ? 'CRITICAL'
                : wastagePercent > allowedWastagePercent * 1.5
                ? 'HIGH'
                : wastagePercent > allowedWastagePercent
                ? 'MEDIUM'
                : 'LOW';

            return {
              franchiseId: franchise.id,
              franchiseName: franchise.name,
              wastagePercent: Math.round(wastagePercent * 100) / 100,
              wastageKg,
              receivedWeightKg,
              allowedWastagePercent,
              severity,
            };
          })
        );

        return heatmap;
      } catch (error: any) {
        console.error('Failed to load wastage heatmap:', error);
        reply.code(500).send({ error: 'Failed to load wastage heatmap' });
      }
    }
  );

  // Discount abuse detection
  fastify.get(
    '/analytics/discount-abuse',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string } }>, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { startDate, endDate } = request.query;
        const dateFilter = getDateRange(startDate, endDate);

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: true,
          },
        });

        const abuseDetection = await Promise.all(
          franchises.map(async (franchise) => {
            const sales = await prisma.sale.findMany({
              where: {
                storeId: franchise.id,
                status: 'PAID',
                createdAt: dateFilter,
              },
            });

            const revenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const totalDiscounts = sales.reduce((sum, s) => sum + s.discountTotal, 0);
            const discountPercent = revenue > 0 ? (totalDiscounts / revenue) * 100 : 0;

            const config = franchise.franchiseConfig;
            const allowedDiscountPercent = config?.allowedDiscountPercent || 10.0;
            const excessDiscount = Math.max(0, discountPercent - allowedDiscountPercent);
            const isAbusing = excessDiscount > 0;

            // Get sales with high discounts
            const highDiscountSales = sales
              .filter((s) => s.discountTotal > 0 && (s.discountTotal / s.grandTotal) * 100 > allowedDiscountPercent)
              .map((s) => ({
                saleNo: s.saleNo,
                discountAmount: s.discountTotal,
                discountPercent: (s.discountTotal / s.grandTotal) * 100,
                createdAt: s.createdAt,
              }))
              .slice(0, 10); // Top 10

            return {
              franchiseId: franchise.id,
              franchiseName: franchise.name,
              discountPercent: Math.round(discountPercent * 100) / 100,
              allowedDiscountPercent,
              excessDiscount: Math.round(excessDiscount * 100) / 100,
              totalDiscounts,
              isAbusing,
              highDiscountSales,
            };
          })
        );

        return abuseDetection.filter((d) => d.isAbusing).sort((a, b) => b.excessDiscount - a.excessDiscount);
      } catch (error: any) {
        console.error('Failed to load discount abuse detection:', error);
        reply.code(500).send({ error: 'Failed to load discount abuse detection' });
      }
    }
  );
}

