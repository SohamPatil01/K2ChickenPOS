// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

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

export async function hqReplenishmentRoutes(fastify: FastifyInstance) {
  // Calculate sales velocity and generate replenishment request
  fastify.post(
    '/replenishment/calculate',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const { franchiseStoreId, productId, leadTimeDays = 3, safetyBufferDays = 2 } = (request.body as any);

        // Verify store access
        const franchise = await prisma.store.findUnique({
          where: { id: franchiseStoreId },
        });

        if (!franchise || (franchise.id !== storeId && franchise.parentOwnerStoreId !== storeId)) {
          reply.code(403).send({ error: 'Access denied' });
          return;
        }

        const now = new Date();
        const period7d = new Date(now);
        period7d.setDate(period7d.getDate() - 7);
        const period14d = new Date(now);
        period14d.setDate(period14d.getDate() - 14);
        const period30d = new Date(now);
        period30d.setDate(period30d.getDate() - 30);

        // Calculate sales velocity (sales per day)
        const sales7d = await prisma.sale.findMany({
          where: {
            storeId: franchiseStoreId,
            status: 'PAID',
            createdAt: { gte: period7d },
          },
          include: {
            items: {
              where: { productId },
            },
          },
        });

        const sales14d = await prisma.sale.findMany({
          where: {
            storeId: franchiseStoreId,
            status: 'PAID',
            createdAt: { gte: period14d },
          },
          include: {
            items: {
              where: { productId },
            },
          },
        });

        const sales30d = await prisma.sale.findMany({
          where: {
            storeId: franchiseStoreId,
            status: 'PAID',
            createdAt: { gte: period30d },
          },
          include: {
            items: {
              where: { productId },
            },
          },
        });

        const calculateVelocity = (sales: any[], days: number) => {
          const totalQty = sales.reduce((sum: any, s: any) => {
            return sum + s.items.reduce((itemSum: number, item: any) => itemSum + (item.qtyKg || 0) + (item.qtyPcs || 0), 0);
          }, 0);
          return days > 0 ? totalQty / days : 0;
        };

        const salesVelocity7d = calculateVelocity(sales7d, 7);
        const salesVelocity14d = calculateVelocity(sales14d, 14);
        const salesVelocity30d = calculateVelocity(sales30d, 30);

        // Use weighted average (more weight to recent data)
        const avgVelocity = (salesVelocity7d * 0.5 + salesVelocity14d * 0.3 + salesVelocity30d * 0.2);

        // Get current stock
        const ledgers = await prisma.inventoryLedger.findMany({
          where: {
            storeId: franchiseStoreId,
            productId,
          },
          orderBy: { createdAt: 'asc' },
        });

        let currentStockKg = 0;
        let currentStockPcs = 0;
        for (const ledger of ledgers) {
          if (ledger.type === 'IN') {
            currentStockKg += ledger.qtyKg || 0;
            currentStockPcs += ledger.qtyPcs || 0;
          } else {
            currentStockKg -= ledger.qtyKg || 0;
            currentStockPcs -= ledger.qtyPcs || 0;
          }
        }
        currentStockKg = Math.max(0, currentStockKg);
        currentStockPcs = Math.max(0, currentStockPcs);

        // Calculate demand
        const totalDays = leadTimeDays + safetyBufferDays;
        const calculatedDemandKg = avgVelocity * totalDays;
        const calculatedDemandPcs = Math.ceil(calculatedDemandKg); // Simplified

        // Create replenishment request
        const replenishmentRequest = await prisma.replenishmentRequest.create({
          data: {
            franchiseStoreId,
            productId,
            salesVelocity7d,
            salesVelocity14d,
            salesVelocity30d,
            currentStockKg,
            currentStockPcs,
            leadTimeDays,
            safetyBufferDays,
            calculatedDemandKg,
            calculatedDemandPcs,
            requestedQtyKg: calculatedDemandKg,
            requestedQtyPcs: calculatedDemandPcs,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            franchiseStore: {
              select: { id: true, name: true, parentOwnerStoreId: true },
            },
          },
        });

        return replenishmentRequest;
      } catch (error: any) {
        console.error('Failed to calculate replenishment:', error);
        reply.code(500).send({ error: 'Failed to calculate replenishment' });
      }
    }
  );

  // Get replenishment requests
  fastify.get(
    '/replenishment/requests',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Querystring: {
          franchiseStoreId?: string;
          status?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { franchiseStoreId, status } = (request.query as any);

        const where: any = {};
        if (franchiseStoreId) {
          where.franchiseStoreId = franchiseStoreId;
        }
        if (status) {
          where.status = status;
        }

        const requests = await prisma.replenishmentRequest.findMany({
          where,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            franchiseStore: {
              select: { id: true, name: true, parentOwnerStoreId: true },
            },
            approver: {
              select: { id: true, name: true },
            },
          },
          orderBy: { requestedAt: 'desc' },
        });

        // Filter by owner store
        const filtered = requests.filter(
          (r) => r.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        return filtered;
      } catch (error: any) {
        console.error('Failed to load replenishment requests:', error);
        reply.code(500).send({ error: 'Failed to load replenishment requests' });
      }
    }
  );

  // Approve/Reject replenishment request
  fastify.patch(
    '/replenishment/requests/:id/approve',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          approved: boolean;
          adjustedQtyKg?: number;
          adjustedQtyPcs?: number;
          adjustmentReason?: string;
          approvalNotes?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const { id } = (request.params as any);
        const { approved, adjustedQtyKg, adjustedQtyPcs, adjustmentReason, approvalNotes } = (request.body as any);

        const req = await prisma.replenishmentRequest.findUnique({
          where: { id },
          include: {
            franchiseStore: true,
          },
        });

        if (!req || req.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Replenishment request not found' });
          return;
        }

        const updated = await prisma.replenishmentRequest.update({
          where: { id },
          data: {
            status: approved ? 'APPROVED' : 'REJECTED',
            approvedBy: userId,
            approvedAt: new Date(),
            approvalNotes,
            adjustedQtyKg: adjustedQtyKg !== undefined ? adjustedQtyKg : req.requestedQtyKg,
            adjustedQtyPcs: adjustedQtyPcs !== undefined ? adjustedQtyPcs : req.requestedQtyPcs,
            adjustmentReason,
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to approve/reject request:', error);
        reply.code(500).send({ error: 'Failed to approve/reject request' });
      }
    }
  );

  // Get central demand view (aggregated across all franchises)
  fastify.get(
    '/replenishment/central-demand',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Querystring: {
          productId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { productId } = (request.query as any);

        const where: any = {
          status: 'PENDING',
        };

        if (productId) {
          where.productId = productId;
        }

        const requests = await prisma.replenishmentRequest.findMany({
          where,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            franchiseStore: {
              select: { id: true, name: true, parentOwnerStoreId: true },
            },
          },
        });

        // Filter by owner store
        const filtered = requests.filter(
          (r) => r.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        // Aggregate by product
        const aggregated = filtered.reduce((acc: any, req) => {
          const key = req.productId;
          if (!acc[key]) {
            acc[key] = {
              product: req.product,
              totalDemandKg: 0,
              totalDemandPcs: 0,
              franchiseCount: 0,
              requests: [],
            };
          }
          acc[key].totalDemandKg += req.calculatedDemandKg;
          acc[key].totalDemandPcs += req.calculatedDemandPcs;
          acc[key].franchiseCount++;
          acc[key].requests.push({
            franchise: req.franchiseStore,
            demandKg: req.calculatedDemandKg,
            demandPcs: req.calculatedDemandPcs,
            requestId: req.id,
          });
          return acc;
        }, {} as any);

        return Object.values(aggregated);
      } catch (error: any) {
        console.error('Failed to load central demand:', error);
        reply.code(500).send({ error: 'Failed to load central demand' });
      }
    }
  );
}

