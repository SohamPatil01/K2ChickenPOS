import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';

function getDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return {
      gte: start,
      lte: end,
    };
  }
  return undefined;
}

export async function hqYieldIntelligenceRoutes(fastify: FastifyInstance) {
  // Calculate yield intelligence for a franchise
  fastify.post(
    '/yield-intelligence/calculate',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Body: {
          franchiseConfigId: string;
          productId?: string;
          periodStart: string;
          periodEnd: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { franchiseConfigId, productId, periodStart, periodEnd } = request.body;

        const config = await prisma.franchiseConfig.findUnique({
          where: { id: franchiseConfigId },
          include: {
            franchiseStore: true,
          },
        });

        if (!config || config.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise config not found' });
          return;
        }

        const dateFilter = getDateRange(periodStart, periodEnd);
        if (!dateFilter) {
          reply.code(400).send({ error: 'Period start and end dates are required' });
          return;
        }

        const products = productId
          ? [await prisma.product.findUnique({ where: { id: productId } })]
          : await prisma.product.findMany({
              where: {
                ownerStoreId,
                isActive: true,
              },
            });

        const results = [];

        for (const product of products) {
          if (!product) continue;

          const productMaster = await prisma.productMaster.findUnique({
            where: { productId: product.id },
          });

          if (!productMaster) continue;

          const expectedYieldPercent = productMaster.expectedYieldPercent || 100;

          // Get received stock
          const receivedLedgers = await prisma.inventoryLedger.findMany({
            where: {
              storeId: config.franchiseStoreId,
              productId: product.id,
              type: 'IN',
              reason: 'RECEIVE',
              createdAt: dateFilter,
            },
          });

          const totalReceivedKg = receivedLedgers.reduce((sum, l) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
          const expectedYieldKg = totalReceivedKg * (expectedYieldPercent / 100);

          // Get actual yield (sold)
          const soldLedgers = await prisma.inventoryLedger.findMany({
            where: {
              storeId: config.franchiseStoreId,
              productId: product.id,
              type: 'OUT',
              reason: 'SALE',
              createdAt: dateFilter,
            },
          });

          const actualYieldKg = soldLedgers.reduce((sum, l) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
          const yieldEfficiency = expectedYieldKg > 0 ? (actualYieldKg / expectedYieldKg) * 100 : 0;

          // Get wastage (loss attribution)
          const wastageLedgers = await prisma.inventoryLedger.findMany({
            where: {
              storeId: config.franchiseStoreId,
              productId: product.id,
              reason: 'WASTAGE',
              createdAt: dateFilter,
            },
          });

          const totalWastageKg = wastageLedgers.reduce((sum, l) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);

          // Loss attribution (simplified - in production, track specific loss types)
          const totalLossKg = totalReceivedKg - actualYieldKg;
          const cuttingLossKg = totalLossKg * 0.4; // 40% cutting loss
          const spoilageLossKg = totalWastageKg * 0.6; // 60% of wastage is spoilage
          const theftSuspicionKg = Math.max(0, totalLossKg - cuttingLossKg - spoilageLossKg);
          const otherLossKg = totalLossKg - cuttingLossKg - spoilageLossKg - theftSuspicionKg;

          // Create or update yield intelligence record
          const periodStartDate = new Date(periodStart);
          const periodEndDate = new Date(periodEnd);
          
          const existing = await prisma.yieldIntelligence.findFirst({
            where: {
              franchiseConfigId,
              productId: product.id,
              periodStart: periodStartDate,
              periodEnd: periodEndDate,
            },
          });

          const yieldIntelligence = existing
            ? await prisma.yieldIntelligence.update({
                where: { id: existing.id },
                data: {
                  expectedYieldKg,
                  actualYieldKg,
                  yieldEfficiency,
                  cuttingLossKg,
                  spoilageLossKg,
                  theftSuspicionKg,
                  otherLossKg,
                  totalReceivedKg,
                },
              })
            : await prisma.yieldIntelligence.create({
                data: {
                  franchiseConfigId,
                  productId: product.id,
                  periodStart: periodStartDate,
                  periodEnd: periodEndDate,
                  expectedYieldKg,
                  actualYieldKg,
                  yieldEfficiency,
                  cuttingLossKg,
                  spoilageLossKg,
                  theftSuspicionKg,
                  otherLossKg,
                  totalReceivedKg,
                },
              });

          results.push({
            product: {
              id: product.id,
              name: product.name,
              sku: product.sku,
            },
            yieldIntelligence,
          });
        }

        return results;
      } catch (error: any) {
        console.error('Failed to calculate yield intelligence:', error);
        reply.code(500).send({ error: 'Failed to calculate yield intelligence' });
      }
    }
  );

  // Get yield intelligence data
  fastify.get(
    '/yield-intelligence',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Querystring: {
          franchiseConfigId?: string;
          productId?: string;
          startDate?: string;
          endDate?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { franchiseConfigId, productId, startDate, endDate } = request.query;

        const where: any = {};
        if (franchiseConfigId) {
          where.franchiseConfigId = franchiseConfigId;
        }
        if (productId) {
          where.productId = productId;
        }
        if (startDate && endDate) {
          where.periodStart = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        const intelligence = await prisma.yieldIntelligence.findMany({
          where,
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true },
                },
              },
            },
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
          orderBy: { periodStart: 'desc' },
        });

        // Filter by owner store
        const filtered = intelligence.filter(
          (i) => i.franchiseConfig.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        return filtered;
      } catch (error: any) {
        console.error('Failed to load yield intelligence:', error);
        reply.code(500).send({ error: 'Failed to load yield intelligence' });
      }
    }
  );

  // Get efficiency ranking
  fastify.get(
    '/yield-intelligence/ranking',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Querystring: {
          startDate?: string;
          endDate?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
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

        const rankings = await Promise.all(
          franchises
            .filter((f) => f.franchiseConfig)
            .map(async (franchise) => {
              const intelligence = await prisma.yieldIntelligence.findMany({
                where: {
                  franchiseConfigId: franchise.franchiseConfig!.id,
                  periodStart: dateFilter,
                },
              });

              const avgEfficiency =
                intelligence.length > 0
                  ? intelligence.reduce((sum, i) => sum + i.yieldEfficiency, 0) / intelligence.length
                  : 0;

              return {
                franchiseId: franchise.id,
                franchiseName: franchise.name,
                averageEfficiency: avgEfficiency,
                totalProducts: intelligence.length,
              };
            })
        );

        rankings.sort((a, b) => b.averageEfficiency - a.averageEfficiency);

        return rankings;
      } catch (error: any) {
        console.error('Failed to load efficiency ranking:', error);
        reply.code(500).send({ error: 'Failed to load efficiency ranking' });
      }
    }
  );
}

