// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { inventoryAdjustSchema, wastageSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

export async function inventoryRoutes(fastify: FastifyInstance) {

  // Diagnostic endpoint to check ledger entries
  fastify.get('/debug', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getUser(request as any);
      const storeId = user.storeId;
      
      const allLedgers = await prisma.inventoryLedger.findMany({
        where: { storeId },
        include: {
          product: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      
      return {
        storeId,
        totalLedgerEntries: allLedgers.length,
        recentEntries: allLedgers.map(l => ({
          id: l.id,
          productId: l.productId,
          productName: l.product?.name,
          type: l.type,
          qtyKg: l.qtyKg,
          qtyPcs: l.qtyPcs,
          reason: l.reason,
          createdAt: l.createdAt,
        })),
      };
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to get debug info', details: error.message });
    }
  });

  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if storeId is provided in query params
      const queryStoreId = (request.query as any)?.storeId;
      
      // Try to get user's store from authentication, fallback to query param or default store
      let user;
      let store;
      let storeId = '';
      
      try {
        user = getUser(request as any);
        if (user && (user as any).storeId) {
          storeId = queryStoreId || (user as any).storeId; // Use query param if provided, otherwise user's store
        store = await prisma.store.findUnique({ 
          where: { id: storeId },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
        });
        console.log(`[Inventory Summary] User store ID: ${storeId}, Store name: ${store?.name}, Store type: ${store?.type}`);
        }
      } catch (authError: any) {
        // Not authenticated, use query param or default to oldest OWNER store
        if (queryStoreId) {
          storeId = queryStoreId;
          store = await prisma.store.findUnique({ 
          where: { id: storeId },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
        });
          console.log(`[Inventory Summary] Using query store ID: ${storeId}`);
        } else {
          console.log('[Inventory Summary] User not authenticated, using fallback store');
          const defaultStore = await prisma.store.findFirst({ 
            where: { type: 'OWNER' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, type: true, parentOwnerStoreId: true }
          });
          storeId = defaultStore?.id || '';
          store = defaultStore;
        }
      }
      
      if (!storeId || !store) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }
      
      if (!store) {
        console.error(`[Inventory Summary] Store not found for ID: ${storeId}`);
        reply.code(404).send({ error: 'Store not found', details: `Store with ID ${storeId} does not exist` });
        return;
      }

      const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      console.log(`[Inventory Summary] Owner store ID: ${ownerStoreId}, Querying store ID: ${storeId}`);

      // Get all products
      const products = await prisma.product.findMany({
        where: {
          ownerStoreId,
          isActive: true,
        },
        include: {
          inventoryLedgers: {
            where: { storeId },
            // Remove orderBy to get all entries, order doesn't matter for calculation
          },
          storeProductPrices: {
            where: {
              storeId,
              isActive: true,
            },
            orderBy: {
              effectiveFrom: 'desc',
            },
            take: 1,
          },
        },
      });

      console.log(`[Inventory Summary] Found ${products.length} products for store ${storeId}`);

      // Also verify we can query ledger entries directly
      const allLedgers = await prisma.inventoryLedger.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 10, // Get more for verification
      });
      console.log(`[Inventory Summary] Direct ledger query for store ${storeId}: Found ${allLedgers.length} total entries`);
      if (allLedgers.length > 0) {
        console.log(`[Inventory Summary] Recent ledger entries (last 10):`);
        allLedgers.forEach((ledger, idx) => {
          console.log(`[Inventory Summary]   ${idx + 1}. Product: ${ledger.productId}, Type: ${ledger.type}, QtyKg: ${ledger.qtyKg}, QtyPcs: ${ledger.qtyPcs}, Reason: ${ledger.reason}, Created: ${ledger.createdAt}`);
        });
      } else {
        console.log(`[Inventory Summary] ⚠️ No ledger entries found for store ${storeId}!`);
      }

      const summary = products.map((product: any) => {
        let totalQtyKg = 0;
        let totalQtyPcs = 0;

        console.log(`[Inventory Summary] Product ${product.name} (${product.id}) has ${product.inventoryLedgers.length} ledger entries for store ${storeId}`);

        // Log each ledger entry for debugging
        product.inventoryLedgers.forEach((ledger: any, index: number) => {
          console.log(`[Inventory Summary]   Ledger ${index + 1}: type=${ledger.type}, qtyKg=${ledger.qtyKg}, qtyPcs=${ledger.qtyPcs}, reason=${ledger.reason}, storeId=${ledger.storeId}`);
        });

        for (const ledger of product.inventoryLedgers) {
          // Verify the ledger belongs to the correct store
          if (ledger.storeId !== storeId) {
            console.warn(`[Inventory Summary] ⚠️ Ledger entry ${ledger.id} has storeId ${ledger.storeId} but expected ${storeId}`);
            continue; // Skip entries that don't match
          }
          
          // Handle null/undefined values properly
          const qtyKg = ledger.qtyKg !== null && ledger.qtyKg !== undefined ? ledger.qtyKg : 0;
          const qtyPcs = ledger.qtyPcs !== null && ledger.qtyPcs !== undefined ? ledger.qtyPcs : 0;
          
          if (ledger.type === 'IN') {
            // Round during each operation to prevent floating point precision errors
            totalQtyKg = Math.round((totalQtyKg + qtyKg) * 1000) / 1000;
            totalQtyPcs = Math.round(totalQtyPcs + qtyPcs);
          } else {
            // Round during each operation to prevent floating point precision errors
            totalQtyKg = Math.round((totalQtyKg - qtyKg) * 1000) / 1000;
            totalQtyPcs = Math.round(totalQtyPcs - qtyPcs);
          }
        }
        
        // Ensure non-negative values and final rounding (use 3 decimal places for consistency)
        totalQtyKg = Math.max(0, Math.round(totalQtyKg * 1000) / 1000);
        totalQtyPcs = Math.max(0, Math.round(totalQtyPcs));
        
        console.log(`[Inventory Summary] Product ${product.name} calculated totals: ${totalQtyKg} kg, ${totalQtyPcs} pcs`);

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          plu: product.plu,
          unitType: product.unitType,
          currentQtyKg: totalQtyKg,
          currentQtyPcs: totalQtyPcs,
          imageUrl: product.imageUrl,
          pricePerUnit: product.storeProductPrices[0]?.pricePerUnit || 0,
        };
      });

      console.log(`[Inventory Summary] Returning ${summary.length} items`);
      return summary;
    } catch (error: any) {
      console.error('[Inventory Summary] Error:', error);
      console.error('[Inventory Summary] Error stack:', error.stack);
      console.error('[Inventory Summary] Error name:', error.name);
      console.error('[Inventory Summary] Error code:', error.code);
      
      reply.code(500).send({ 
        error: 'Failed to load inventory summary', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      });
    }
  });

  fastify.post('/adjust', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      
      // Prepare data for validation - ensure qtyPcs is integer if provided
      const validationData: any = {
        productId: body.productId,
        reason: body.reason || 'ADJUSTMENT',
      };
      
      if (body.qtyKg !== undefined && body.qtyKg !== null) {
        // Preserve exact value - don't round, just parse
        const parsed = typeof body.qtyKg === 'string' ? parseFloat(body.qtyKg) : body.qtyKg;
        validationData.qtyKg = isNaN(parsed) ? 0 : parsed;
      }
      if (body.qtyPcs !== undefined && body.qtyPcs !== null) {
        validationData.qtyPcs = Math.round(parseFloat(body.qtyPcs));
      }
      
      const data = inventoryAdjustSchema.parse(validationData);
      const user = getUser(request);
      const storeId = user.storeId;
      const userId = user.userId;

      if (!storeId || !userId) {
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      // Determine if it's IN or OUT based on quantity sign
      const qty = data.qtyKg || data.qtyPcs || 0;
      if (qty === 0) {
        reply.code(400).send({ error: 'Quantity cannot be zero' });
        return;
      }

      // Ensure at least one quantity is provided
      if (!data.qtyKg && !data.qtyPcs) {
        reply.code(400).send({ error: 'Either qtyKg or qtyPcs must be provided' });
        return;
      }

      const type = qty > 0 ? 'IN' : 'OUT';
      // Store absolute values in ledger - preserve exact decimal precision for qtyKg
      const absQtyKg = data.qtyKg !== undefined && data.qtyKg !== null ? Math.abs(data.qtyKg) : undefined;
      const absQtyPcs = data.qtyPcs !== undefined && data.qtyPcs !== null ? Math.abs(data.qtyPcs) : undefined;
      
      // Ensure at least one quantity will be stored
      if (absQtyKg === undefined && absQtyPcs === undefined) {
        reply.code(400).send({ error: 'At least one quantity (qtyKg or qtyPcs) must be provided' });
        return;
      }

      // Validate reason enum value
      const validReasons = ['SALE', 'RECEIVE', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER', 'CORRECTION', 'DAMAGE', 'OTHER', 'OPENING', 'RETURN', 'YIELD'];
      const reason = (data.reason as string)?.toUpperCase() || 'ADJUSTMENT';
      if (!validReasons.includes(reason)) {
        reply.code(400).send({ 
          error: 'Invalid reason value', 
          details: `Reason must be one of: ${validReasons.join(', ')}`,
          received: data.reason
        });
        return;
      }

      // Check if the reason exists in the database enum
      // If CORRECTION or other new values don't exist, fallback to ADJUSTMENT
      const dbEnumCheck = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (
          SELECT oid 
          FROM pg_type 
          WHERE typname = 'InventoryReason'
        ) AND enumlabel = ${reason};
      `;
      
      const dbReason = dbEnumCheck.length > 0 ? reason : 'ADJUSTMENT';
      if (dbReason !== reason) {
        console.warn(`[Inventory Adjust] Reason ${reason} not found in database enum, using ${dbReason} instead`);
      }

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        reply.code(404).send({ error: 'Product not found' });
        return;
      }

      console.log(`[Inventory Adjust] Creating ledger entry:`, {
        storeId,
        productId: data.productId,
        type,
        qtyKg: absQtyKg,
        qtyPcs: absQtyPcs,
        reason: dbReason,
        originalReason: reason,
        originalInput: { qtyKg: body.qtyKg, qtyPcs: body.qtyPcs },
        parsedData: { qtyKg: data.qtyKg, qtyPcs: data.qtyPcs },
      });

      const ledger = await prisma.inventoryLedger.create({
        data: {
          storeId,
          productId: data.productId,
          type,
          qtyKg: absQtyKg,
          qtyPcs: absQtyPcs,
          reason: dbReason as any,
        },
      });

      console.log(`[Inventory Adjust] ✅ Ledger entry created:`, {
        id: ledger.id,
        storeId: ledger.storeId,
        productId: ledger.productId,
        type: ledger.type,
        qtyKg: ledger.qtyKg,
        qtyPcs: ledger.qtyPcs,
        reason: ledger.reason,
        createdAt: ledger.createdAt,
      });

      // Create audit log (non-blocking - don't fail if this fails)
      try {
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
        console.log(`[Inventory Adjust] ✅ Audit log created`);
      } catch (auditError: any) {
        console.error(`[Inventory Adjust] ⚠️ Failed to create audit log (non-critical):`, auditError);
        // Continue even if audit log creation fails
      }

      // Verify the entry was created by querying it back
      const verifyLedger = await prisma.inventoryLedger.findUnique({
        where: { id: ledger.id },
      });
      console.log(`[Inventory Adjust] Verification: Ledger entry exists:`, verifyLedger ? 'YES' : 'NO');
      
      // Also verify it can be queried by storeId and productId
      const verifyQuery = await prisma.inventoryLedger.findMany({
        where: {
          storeId: ledger.storeId,
          productId: ledger.productId,
        },
      });
      console.log(`[Inventory Adjust] Verification query: Found ${verifyQuery.length} total ledger entries for product ${ledger.productId} in store ${ledger.storeId}`);

      return ledger;
    } catch (error: any) {
      console.error('[Inventory Adjust] ❌ Error:', error);
      console.error('[Inventory Adjust] Error name:', error.name);
      console.error('[Inventory Adjust] Error message:', error.message);
      console.error('[Inventory Adjust] Error code:', error.code);
      console.error('[Inventory Adjust] Error stack:', error.stack);
      
      if (error.name === 'ZodError') {
        reply.code(400).send({ error: 'Invalid input data', details: error.errors });
        return;
      }
      if (error.message === 'User not authenticated' || error.message?.includes('authenticated')) {
        reply.code(401).send({ error: 'User not authenticated' });
        return;
      }
      if (error.code === 'P2002') {
        reply.code(400).send({ error: 'Duplicate entry', details: error.meta });
        return;
      }
      if (error.code === 'P2003') {
        reply.code(400).send({ error: 'Foreign key constraint failed', details: error.meta });
        return;
      }
      reply.code(500).send({ 
        error: 'Failed to adjust inventory',
        details: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN'
      });
    }
  });

  fastify.post('/wastage', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = wastageSchema.parse(request.body as any);
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

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
  fastify.get('/ledger', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const storeId = (getUser(request) as any).storeId;
      const query = request.query as any;
      const { startDate, endDate, type, reason, productId } = query;

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
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;
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

