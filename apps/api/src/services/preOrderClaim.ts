import { Prisma } from '@azela-pos/db';

export type PreOrderClaimCode =
  | 'PRE_ORDER_NOT_FOUND'
  | 'PRE_ORDER_ALREADY_BILLED'
  | 'PRE_ORDER_CLOSED'
  | 'PRE_ORDER_WRONG_STORE';

export class PreOrderClaimError extends Error {
  statusCode: 404 | 409;
  code: PreOrderClaimCode;
  preOrderIds: string[];
  existingSaleId?: string;
  existingSaleNo?: string;
  trackingCode?: string;

  constructor(opts: {
    statusCode: 404 | 409;
    code: PreOrderClaimCode;
    message: string;
    preOrderIds: string[];
    existingSaleId?: string;
    existingSaleNo?: string;
    trackingCode?: string;
  }) {
    super(opts.message);
    this.name = 'PreOrderClaimError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.preOrderIds = opts.preOrderIds;
    this.existingSaleId = opts.existingSaleId;
    this.existingSaleNo = opts.existingSaleNo;
    this.trackingCode = opts.trackingCode;
  }
}

/**
 * Collect every pre-order ID referenced by a sale payload — both top-level `preOrderIds`
 * and per-line `items[].metaJson.preOrderId` — deduplicated and sorted for deterministic lock order.
 */
export function extractPreOrderIdsFromSaleInput(input: {
  preOrderIds?: unknown;
  items?: Array<{ metaJson?: Record<string, unknown> | null }> | null;
}): string[] {
  const ids = new Set<string>();
  if (Array.isArray(input.preOrderIds)) {
    for (const raw of input.preOrderIds) {
      const id = typeof raw === 'string' ? raw.trim() : '';
      if (id) ids.add(id);
    }
  }
  if (Array.isArray(input.items)) {
    for (const item of input.items) {
      const meta = item?.metaJson;
      if (meta && typeof meta === 'object' && typeof meta.preOrderId === 'string') {
        const id = meta.preOrderId.trim();
        if (id) ids.add(id);
      }
    }
  }
  return [...ids].sort();
}

type LockedPreOrderRow = {
  id: string;
  storeId: string;
  trackingCode: string;
  status: string;
  saleId: string | null;
};

type ClaimTx = {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
  sale: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; saleNo: true; status: true };
    }) => Promise<{ id: string; saleNo: string; status: string } | null>;
  };
  preOrder: {
    findMany: (args: any) => Promise<Array<{ id: string; trackingCode: string }>>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<{ count: number }>;
  };
  preOrderEvent: {
    create: (args: any) => Promise<any>;
  };
};

/**
 * Acquire row-level `FOR UPDATE` locks on every referenced pre-order at the start of
 * the sale transaction and verify none is already billed, cancelled, or for another store.
 *
 * Two cashiers clicking Pay at the exact same instant serialize on `FOR UPDATE`:
 * the winner creates the Sale and marks `FULFILLED`; the second wakes up, sees
 * the committed `saleId`, and aborts before creating a duplicate bill.
 */
export async function lockAndVerifyPreOrdersForSale(
  tx: ClaimTx,
  opts: { preOrderIds: string[]; storeId: string }
): Promise<LockedPreOrderRow[]> {
  const sortedIds = [...new Set(opts.preOrderIds.map((id) => id.trim()).filter(Boolean))].sort();
  if (sortedIds.length === 0) return [];

  const rows = await tx.$queryRaw<LockedPreOrderRow[]>(Prisma.sql`
    SELECT id, "storeId", "trackingCode", status::text AS status, "saleId"
    FROM "PreOrder"
    WHERE id IN (${Prisma.join(sortedIds)})
    ORDER BY id
    FOR UPDATE
  `);

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of sortedIds) {
    const row = byId.get(id);
    if (!row) {
      throw new PreOrderClaimError({
        statusCode: 404,
        code: 'PRE_ORDER_NOT_FOUND',
        message: 'App order not found.',
        preOrderIds: sortedIds,
      });
    }

    const label = row.trackingCode ? `#${row.trackingCode}` : row.id.slice(-6);

    if (row.status === 'CANCELLED' || row.status === 'NO_SHOW') {
      throw new PreOrderClaimError({
        statusCode: 409,
        code: 'PRE_ORDER_CLOSED',
        message: `Order ${label} is ${row.status.toLowerCase().replace('_', '-')} and cannot be billed.`,
        preOrderIds: sortedIds,
        trackingCode: row.trackingCode,
      });
    }

    if (row.saleId) {
      const linkedSale = await tx.sale.findUnique({
        where: { id: row.saleId },
        select: { id: true, saleNo: true, status: true },
      });
      // Only a VOID bill frees the order to be re-billed; OPEN / PAID / REFUNDED block duplicates.
      if (linkedSale && linkedSale.status !== 'VOID') {
        throw new PreOrderClaimError({
          statusCode: 409,
          code: 'PRE_ORDER_ALREADY_BILLED',
          message: `Order ${label} has already been billed (${linkedSale.saleNo}).`,
          preOrderIds: sortedIds,
          existingSaleId: linkedSale.id,
          existingSaleNo: linkedSale.saleNo,
          trackingCode: row.trackingCode,
        });
      }
    } else if (row.status === 'FULFILLED') {
      throw new PreOrderClaimError({
        statusCode: 409,
        code: 'PRE_ORDER_ALREADY_BILLED',
        message: `Order ${label} is already marked completed.`,
        preOrderIds: sortedIds,
        trackingCode: row.trackingCode,
      });
    }

    if (row.storeId !== opts.storeId) {
      throw new PreOrderClaimError({
        statusCode: 409,
        code: 'PRE_ORDER_WRONG_STORE',
        message: `Order ${label} belongs to another store and cannot be billed here.`,
        preOrderIds: sortedIds,
        trackingCode: row.trackingCode,
      });
    }
  }

  return rows;
}

/**
 * Link and mark locked pre-orders `FULFILLED` inside the same transaction that created the `Sale`.
 */
export async function completePreOrderClaimForSale(
  tx: ClaimTx,
  opts: {
    preOrderIds: string[];
    saleId: string;
    saleNo: string;
    actorUserId: string;
  }
): Promise<void> {
  const sortedIds = [...new Set(opts.preOrderIds.map((id) => id.trim()).filter(Boolean))].sort();
  if (sortedIds.length === 0) return;

  for (const id of sortedIds) {
    await tx.preOrder.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        saleId: opts.saleId,
      },
    });
    await tx.preOrderEvent.create({
      data: {
        preOrderId: id,
        kind: 'STATUS',
        status: 'FULFILLED',
        message: `Completed — billed as ${opts.saleNo}`,
        visibleToCustomer: true,
        createdByUserId: opts.actorUserId,
      },
    });
  }
}

/**
 * When a manager/owner voids a mistake bill, release any pre-order linked to that bill
 * back to `CONFIRMED` so the customer's order can be re-billed once cleanly.
 */
export async function releasePreOrdersOnSaleVoid(
  tx: Pick<ClaimTx, 'preOrder' | 'preOrderEvent'>,
  opts: { saleId: string; saleNo: string; actorUserId: string }
): Promise<number> {
  const linked = await tx.preOrder.findMany({
    where: { saleId: opts.saleId, status: 'FULFILLED' },
    select: { id: true, trackingCode: true },
  });
  if (linked.length === 0) return 0;

  let released = 0;
  for (const po of linked) {
    const res = await tx.preOrder.updateMany({
      where: { id: po.id, saleId: opts.saleId, status: 'FULFILLED' },
      data: { saleId: null, status: 'CONFIRMED' },
    });
    if (res.count > 0) {
      released += res.count;
      await tx.preOrderEvent.create({
        data: {
          preOrderId: po.id,
          kind: 'STATUS',
          status: 'CONFIRMED',
          message: `Bill ${opts.saleNo} was voided — order reopened for billing`,
          visibleToCustomer: false,
          createdByUserId: opts.actorUserId,
        },
      });
    }
  }
  return released;
}
