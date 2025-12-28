import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { inventoryAdjustSchema, wastageSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';

export async function inventoryRoutes(fastify: FastifyInstance) {

  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    if (!ownerStoreId) {
      reply.code(400).send({ error: 'Owner store not found' });
      return;
    }

    // Get all products
    const products = await prisma.product.findMany({
      where: {
        ownerStoreId,
        isActive: true,
      },
      include: {
        inventoryLedgers: {
          where: { storeId },
        },
      },
    });

    const summary = products.map((product) => {
      let totalQtyKg = 0;
      let totalQtyPcs = 0;

      for (const ledger of product.inventoryLedgers) {
        if (ledger.type === 'IN') {
          totalQtyKg += ledger.qtyKg || 0;
          totalQtyPcs += ledger.qtyPcs || 0;
        } else {
          totalQtyKg -= ledger.qtyKg || 0;
          totalQtyPcs -= ledger.qtyPcs || 0;
        }
      }

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        plu: product.plu,
        unitType: product.unitType,
        currentQtyKg: totalQtyKg,
        currentQtyPcs: totalQtyPcs,
        imageUrl: product.imageUrl,
      };
    });

    return summary;
  });

  fastify.post('/adjust', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = inventoryAdjustSchema.parse(request.body);
      const storeId = request.user!.storeId;
      const userId = request.user!.userId;

      // Determine if it's IN or OUT based on quantity sign
      const qty = data.qtyKg || data.qtyPcs || 0;
      if (qty === 0) {
        reply.code(400).send({ error: 'Quantity cannot be zero' });
        return;
      }

      const type = qty > 0 ? 'IN' : 'OUT';
      // Store absolute values in ledger
      const absQtyKg = data.qtyKg ? Math.abs(data.qtyKg) : undefined;
      const absQtyPcs = data.qtyPcs ? Math.abs(data.qtyPcs) : undefined;

      const ledger = await prisma.inventoryLedger.create({
        data: {
          storeId,
          productId: data.productId,
          type,
          qtyKg: absQtyKg,
          qtyPcs: absQtyPcs,
          reason: data.reason || 'ADJUSTMENT',
        },
      });

      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'INVENTORY_ADJUSTED',
          entityType: 'InventoryLedger',
          entityId: ledger.id,
          metaJson: { ...data, adjustmentType: type },
        },
      });

      return ledger;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400).send({ error: 'Invalid input data', details: error.errors });
        return;
      }
      reply.code(500).send({ error: 'Failed to adjust inventory' });
    }
  });

  fastify.post('/wastage', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = wastageSchema.parse(request.body);
      const storeId = request.user!.storeId;
      const userId = request.user!.userId;

      // Get franchise config to check wastage lock
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: {
          franchiseConfig: true,
        },
      });

      if (store?.franchiseConfig?.isWastageLocked) {
        // Validate wastage against threshold
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const receivedLedgers = await prisma.inventoryLedger.findMany({
          where: {
            storeId,
            productId: data.productId,
            type: 'IN',
            reason: 'RECEIVE',
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        const totalReceived = receivedLedgers.reduce(
          (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
          0
        );

        const wastageLedgers = await prisma.inventoryLedger.findMany({
          where: {
            storeId,
            productId: data.productId,
            reason: 'WASTAGE',
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        const existingWastage = wastageLedgers.reduce(
          (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
          0
        );

        const totalWastage = existingWastage + (data.qtyKg || 0);
        const wastagePercent = totalReceived > 0 ? (totalWastage / totalReceived) * 100 : 0;
        const allowedPercent = store.franchiseConfig?.allowedWastagePercent || 5.0;

        if (wastagePercent > allowedPercent) {
          reply.code(403).send({
            error: `Wastage exceeds allowed threshold. Current: ${wastagePercent.toFixed(2)}% (Allowed: ${allowedPercent}%)`,
            wastagePercent,
            allowedPercent,
            isExcess: true,
          });
          return;
        }
      }

      const ledger = await prisma.inventoryLedger.create({
        data: {
          storeId,
          productId: data.productId,
          type: 'OUT',
          qtyKg: data.qtyKg,
          qtyPcs: data.qtyPcs,
          reason: 'WASTAGE',
        },
      });

      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'WASTAGE_RECORDED',
          entityType: 'InventoryLedger',
          entityId: ledger.id,
          metaJson: { reason: data.reason },
        },
      });

      return ledger;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400).send({ error: 'Invalid input data', details: error.errors });
        return;
      }
      console.error('Failed to record wastage:', error);
      reply.code(500).send({ error: 'Failed to record wastage' });
    }
  });

  // Get ledger entries
  fastify.get('/ledger', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const storeId = request.user!.storeId;
      const { startDate, endDate, type, reason, productId } = request.query;

      const where: any = { storeId };
      if (type) where.type = type;
      if (reason) where.reason = reason;
      if (productId) where.productId = productId;
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt = { gte: start, lte: end };
      }

      const ledgers = await prisma.inventoryLedger.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      return ledgers;
    } catch (error: any) {
      console.error('Failed to load ledger:', error);
      reply.code(500).send({ error: 'Failed to load ledger' });
    }
  });

  // Create ledger entry (for opening stock, etc.)
  fastify.post('/ledger', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const storeId = request.user!.storeId;
      const userId = request.user!.userId;
      const { productId, type, reason, qtyKg, qtyPcs } = request.body as any;

      if (!productId || !type || !reason) {
        reply.code(400).send({ error: 'productId, type, and reason are required' });
        return;
      }

      const ledger = await prisma.inventoryLedger.create({
        data: {
          storeId,
          productId,
          type,
          reason,
          qtyKg,
          qtyPcs,
        },
      });

      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'LEDGER_ENTRY_CREATED',
          entityType: 'InventoryLedger',
          entityId: ledger.id,
          metaJson: { type, reason, qtyKg, qtyPcs },
        },
      });

      return ledger;
    } catch (error: any) {
      console.error('Failed to create ledger entry:', error);
      reply.code(500).send({ error: 'Failed to create ledger entry' });
    }
  });
}

