// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, Prisma } from '@azela-pos/db';
import { inventoryAdjustSchema, wastageSchema, resolveStoreDateRange } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

/** Signed delta and absolute ledger fields, using product unit with sensible fallback if the wrong field was sent */
function resolveSignedAdjustQty(
  unitType: string,
  qtyKg: number | undefined | null,
  qtyPcs: number | undefined | null
): { signed: number; absQtyKg: number | undefined; absQtyPcs: number | undefined } | null {
  const k =
    qtyKg !== undefined && qtyKg !== null && !Number.isNaN(Number(qtyKg))
      ? Number(qtyKg)
      : null;
  const p =
    qtyPcs !== undefined && qtyPcs !== null && !Number.isNaN(Number(qtyPcs))
      ? Number(qtyPcs)
      : null;

  // Adjust strictly in the product's native unit. Do not coerce a value sent in the
  // wrong field into the native unit — that silent conversion corrupts stock.
  if (unitType === 'KG') {
    if (k !== null && k !== 0) {
      return { signed: k, absQtyKg: Math.abs(k), absQtyPcs: undefined };
    }
    return null;
  }
  if (p !== null && p !== 0) {
    return {
      signed: p,
      absQtyKg: undefined,
      absQtyPcs: Math.abs(Math.round(p)),
    };
  }
  return null;
}

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

  fastify.get('/summary', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queryStoreId = (request.query as any)?.storeId as string | undefined;
      const user = getUser(request as any);
      const storeId = queryStoreId || user.storeId;

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true },
      });

      if (!storeId || !store) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      // Ledger rows are per physical store. Franchise OPEN/PAID sales write OUT with the
      // franchise storeId — OWNER users default to owner storeId and would miss those unless we aggregate.
      const explicitLedgerStore = (request.query as any)?.ledgerStoreId as string | undefined;
      let ledgerStoreIds: string[];
      if (explicitLedgerStore) {
        ledgerStoreIds = [explicitLedgerStore];
      } else if (store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: store.id,
          },
          select: { id: true },
        });
        ledgerStoreIds = [store.id, ...franchises.map((f) => f.id)];
      } else {
        ledgerStoreIds = [storeId];
      }

      // Names for the per-store breakdown (only relevant when aggregating multiple stores).
      const ledgerStoreRows = await prisma.store.findMany({
        where: { id: { in: ledgerStoreIds } },
        select: { id: true, name: true },
      });
      const storeNameById = new Map<string, string>(
        ledgerStoreRows.map((s) => [s.id, s.name])
      );
      const isMultiStore = ledgerStoreIds.length > 1;

      // Products + prices only — do NOT nest all ledger rows (that was loading
      // the full history per product and timing out / 500-ing under POS load).
      const products = await prisma.product.findMany({
        where: {
          ownerStoreId,
          isActive: true,
        },
        include: {
          category: { select: { name: true } },
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

      // One GROUP BY for on-hand qty across the relevant physical stores.
      const balanceRows =
        ledgerStoreIds.length === 0
          ? []
          : await prisma.$queryRaw<
              Array<{ productId: string; storeId: string; qtyKg: number; qtyPcs: number }>
            >`
              SELECT
                "productId",
                "storeId",
                COALESCE(
                  SUM(
                    CASE
                      WHEN type = 'IN' THEN COALESCE("qtyKg", 0)
                      ELSE -COALESCE("qtyKg", 0)
                    END
                  ),
                  0
                )::float AS "qtyKg",
                COALESCE(
                  SUM(
                    CASE
                      WHEN type = 'IN' THEN COALESCE("qtyPcs", 0)
                      ELSE -COALESCE("qtyPcs", 0)
                    END
                  ),
                  0
                )::int AS "qtyPcs"
              FROM "InventoryLedger"
              WHERE "storeId" IN (${Prisma.join(ledgerStoreIds)})
              GROUP BY "productId", "storeId"
            `;

      const balanceByProduct = new Map<string, Map<string, { kg: number; pcs: number }>>();
      for (const row of balanceRows) {
        let perStore = balanceByProduct.get(row.productId);
        if (!perStore) {
          perStore = new Map();
          balanceByProduct.set(row.productId, perStore);
        }
        perStore.set(row.storeId, {
          kg: Number(row.qtyKg) || 0,
          pcs: Number(row.qtyPcs) || 0,
        });
      }

      const summary = products.map((product: any) => {
        const perStore = balanceByProduct.get(product.id);
        let totalQtyKg = 0;
        let totalQtyPcs = 0;
        const storeBreakdown: Array<{
          storeId: string;
          storeName: string;
          qtyKg: number;
          qtyPcs: number;
        }> = [];

        for (const id of ledgerStoreIds) {
          const bucket = perStore?.get(id) || { kg: 0, pcs: 0 };
          const kg = Math.max(0, Math.round(bucket.kg * 1000) / 1000);
          const pcs = Math.max(0, Math.round(bucket.pcs));
          totalQtyKg = Math.round((totalQtyKg + kg) * 1000) / 1000;
          totalQtyPcs += pcs;
          storeBreakdown.push({
            storeId: id,
            storeName: storeNameById.get(id) || id,
            qtyKg: kg,
            qtyPcs: pcs,
          });
        }

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          plu: product.plu,
          unitType: product.unitType,
          currentQtyKg: totalQtyKg,
          currentQtyPcs: totalQtyPcs,
          storeBreakdown: isMultiStore ? storeBreakdown : undefined,
          imageUrl: product.imageUrl,
          pricePerUnit: product.storeProductPrices[0]?.pricePerUnit || 0,
          categoryName: product.category?.name || '',
          createdAt: product.createdAt?.toISOString?.() ?? product.createdAt,
        };
      });

      reply.header('Cache-Control', 'private, max-age=60, s-maxage=60, stale-while-revalidate=180');
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

  /** Compare sale line quantities vs net inventory impact for those sales. */
  fastify.get('/reconciliation', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getUser(request as any);
      const storeId = user.storeId;
      const startDate = (request.query as any)?.startDate as string | undefined;
      const endDate = (request.query as any)?.endDate as string | undefined;
      if (!startDate || !endDate) {
        reply.code(400).send({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
        return;
      }
      const { gte: start, lte: end } = resolveStoreDateRange(startDate, endDate);

      // Only live bills — VOID/REFUNDED are excluded from "sold". Their ledger
      // rows must also be excluded (otherwise SALE OUT from voids looks like
      // over-deduction while restores sit on ADJUSTMENT IN).
      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          status: { in: ['OPEN', 'PAID'] },
          createdAt: { gte: start, lte: end },
        },
        include: { items: true },
      });

      const soldMap = new Map<string, { kg: number; pcs: number }>();
      for (const s of sales) {
        for (const it of s.items) {
          const meta = it.metaJson as { manualLine?: boolean } | null;
          if (meta?.manualLine) continue;
          const cur = soldMap.get(it.productId) || { kg: 0, pcs: 0 };
          cur.kg += it.qtyKg || 0;
          cur.pcs += it.qtyPcs || 0;
          soldMap.set(it.productId, cur);
        }
      }

      const saleIds = sales.map((s) => s.id);
      const ledgerMap = new Map<string, { kg: number; pcs: number }>();

      if (saleIds.length > 0) {
        // Net every ledger row tied to those sales (SALE OUT + ADJUSTMENT
        // restores from edits). OUT adds to deducted; IN subtracts.
        const ledgerRows = await prisma.inventoryLedger.findMany({
          where: {
            storeId,
            refId: { in: saleIds },
          },
          select: {
            productId: true,
            type: true,
            qtyKg: true,
            qtyPcs: true,
          },
        });

        for (const L of ledgerRows) {
          const sign = L.type === 'OUT' ? 1 : -1;
          const cur = ledgerMap.get(L.productId) || { kg: 0, pcs: 0 };
          cur.kg = Math.round((cur.kg + sign * (L.qtyKg || 0)) * 1000) / 1000;
          cur.pcs += sign * (L.qtyPcs || 0);
          ledgerMap.set(L.productId, cur);
        }
      }

      // Clamp display at 0 — over-restores shouldn't show as negative ledger
      for (const [pid, cur] of ledgerMap) {
        ledgerMap.set(pid, {
          kg: Math.max(0, cur.kg),
          pcs: Math.max(0, cur.pcs),
        });
      }

      const productIds = new Set([...soldMap.keys(), ...ledgerMap.keys()]);
      const products = await prisma.product.findMany({
        where: { id: { in: [...productIds] } },
        select: { id: true, name: true, unitType: true },
      });
      const byId = Object.fromEntries(products.map((p) => [p.id, p]));

      const rows = [...productIds].map((pid) => {
        const sold = soldMap.get(pid) || { kg: 0, pcs: 0 };
        const led = ledgerMap.get(pid) || { kg: 0, pcs: 0 };
        const p = byId[pid];
        return {
          productId: pid,
          productName: p?.name || pid,
          unitType: p?.unitType,
          soldQtyKg: Math.round(sold.kg * 1000) / 1000,
          soldQtyPcs: Math.round(sold.pcs),
          ledgerOutKg: Math.round(led.kg * 1000) / 1000,
          ledgerOutPcs: Math.round(led.pcs),
          deltaKg: Math.round((sold.kg - led.kg) * 1000) / 1000,
          deltaPcs: Math.round(sold.pcs - led.pcs),
        };
      });
      rows.sort((a, b) => a.productName.localeCompare(b.productName));

      return { startDate, endDate, rows };
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to load reconciliation', details: error.message });
    }
  });

  fastify.post('/adjust', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER', 'CASHIER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      
      // Prepare data for validation - ensure qtyPcs is integer if provided
      const validationData: any = {
        productId: body.productId,
        reason: body.reason || 'ADJUSTMENT',
      };

      if (body.ledgerStoreId !== undefined && body.ledgerStoreId !== null && String(body.ledgerStoreId).trim() !== '') {
        validationData.ledgerStoreId = String(body.ledgerStoreId).trim();
      }
      
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
      const userStoreId = user.storeId;
      const userId = user.userId;

      if (!userStoreId || !userId) {
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      const userStore = await prisma.store.findUnique({
        where: { id: userStoreId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });
      if (!userStore) {
        reply.code(400).send({ error: 'User store not found' });
        return;
      }

      const requestedLedgerStoreId =
        data.ledgerStoreId && data.ledgerStoreId.trim() !== ''
          ? data.ledgerStoreId.trim()
          : null;

      let storeId = userStoreId;
      if (requestedLedgerStoreId && requestedLedgerStoreId !== userStoreId) {
        if (user.role === 'MANAGER' || user.role === 'CASHIER') {
          reply.code(403).send({ error: 'You can only adjust inventory for your own store' });
          return;
        }
        if (user.role !== 'OWNER') {
          reply.code(403).send({ error: 'Not allowed to adjust another store' });
          return;
        }
        const target = await prisma.store.findUnique({
          where: { id: requestedLedgerStoreId },
          select: { id: true, type: true, parentOwnerStoreId: true },
        });
        if (!target) {
          reply.code(404).send({ error: 'Store not found' });
          return;
        }
        if (userStore.type === 'OWNER') {
          const allowed =
            target.id === userStore.id ||
            (target.type === 'FRANCHISE' && target.parentOwnerStoreId === userStore.id);
          if (!allowed) {
            reply
              .code(403)
              .send({ error: 'You can only adjust inventory for your HQ or your franchise stores' });
            return;
          }
          storeId = target.id;
        } else {
          reply.code(403).send({ error: 'You can only adjust inventory for your own store' });
          return;
        }
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

      const resolved = resolveSignedAdjustQty(
        product.unitType,
        data.qtyKg,
        data.qtyPcs
      );
      if (!resolved) {
        reply.code(400).send({
          error: 'Quantity cannot be zero',
          details: 'Provide a non-zero qtyKg or qtyPcs for this product unit type',
        });
        return;
      }

      const type = resolved.signed > 0 ? 'IN' : 'OUT';
      const absQtyKg = resolved.absQtyKg;
      const absQtyPcs = resolved.absQtyPcs;

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
        unitType: product.unitType,
        resolvedSigned: resolved.signed,
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
        reply.code(400).send({
          error: 'Invalid input data',
          details: error.issues ?? error.errors,
        });
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
        select: {
          id: true,
          name: true,
          type: true,
          parentOwnerStoreId: true,
          franchiseConfig: true,
        },
      });

      if (store?.franchiseConfig?.isWastageLocked) {
        // Validate wastage against threshold
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Compute the ratio in the product's native unit only — never mix kg + pcs.
        const wastageProduct = await prisma.product.findUnique({
          where: { id: data.productId },
          select: { unitType: true },
        });
        const isKgProduct = (wastageProduct?.unitType || 'KG') === 'KG';
        const qtyForUnit = (ledger: { qtyKg: number | null; qtyPcs: number | null }) =>
          isKgProduct ? ledger.qtyKg || 0 : ledger.qtyPcs || 0;

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
          (sum, ledger) => sum + qtyForUnit(ledger),
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
          (sum, ledger) => sum + qtyForUnit(ledger),
          0
        );

        const newWastageQty = isKgProduct ? data.qtyKg || 0 : data.qtyPcs || 0;
        const totalWastage = existingWastage + newWastageQty;
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
        reply.code(400).send({
          error: 'Invalid input data',
          details: error.issues ?? error.errors,
        });
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
        const startStr = String(startDate).split('T')[0];
        const endStr = String(endDate).split('T')[0];
        if (String(startDate).includes('T') && String(endDate).includes('T')) {
          where.createdAt = {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          };
        } else {
          where.createdAt = resolveStoreDateRange(startStr, endStr);
        }
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

