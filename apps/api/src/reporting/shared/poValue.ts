// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { round2 } from './metrics.js';

/** PO statuses where stock has been received and counted. */
export const RECEIVED_PO_STATUSES = ['RECEIVED', 'CLOSED'] as const;

type StoreFilter = string | { in: string[] };

type PoLine = {
  requestedRate?: number | null;
  receivedQtyKg?: number | null;
  receivedQtyPcs?: number | null;
  qtyKg?: number | null;
  qtyPcs?: number | null;
};

/**
 * Value of a PO line from received qty only (never ordered qty).
 * Uses kg OR pcs, not both, to avoid double-counting.
 */
export function poLineReceivedValue(item: PoLine): number {
  const rate = item.requestedRate ?? 0;
  if (rate <= 0) return 0;

  const recvKg = item.receivedQtyKg ?? 0;
  const recvPcs = item.receivedQtyPcs ?? 0;
  if (recvKg > 0) return rate * recvKg;
  if (recvPcs > 0) return rate * recvPcs;
  return 0;
}

/** Legacy PO line value — received qty with ordered fallback (for open PO reports). */
export function poLineValue(item: PoLine): number {
  const rate = item.requestedRate ?? 0;
  if (rate <= 0) return 0;

  const recvKg = item.receivedQtyKg ?? 0;
  const recvPcs = item.receivedQtyPcs ?? 0;
  if (recvKg > 0) return rate * recvKg;
  if (recvPcs > 0) return rate * recvPcs;

  const ordKg = item.qtyKg ?? 0;
  const ordPcs = item.qtyPcs ?? 0;
  if (ordKg > 0) return rate * ordKg;
  if (ordPcs > 0) return rate * ordPcs;
  return 0;
}

export function sumReceivedPoValue(
  pos: Array<{ status: string; items: PoLine[] }>
): number {
  let total = 0;
  for (const po of pos) {
    if (!RECEIVED_PO_STATUSES.includes(po.status as (typeof RECEIVED_PO_STATUSES)[number])) {
      continue;
    }
    for (const item of po.items) {
      total += poLineReceivedValue(item);
    }
  }
  return round2(total);
}

/**
 * Purchase value received within a calendar range.
 * Uses GRN receivedAt (when stock was GRN'd), not PO createdAt.
 * Fallback: PO updatedAt for finalize-only flows without a GRN record.
 */
export async function getReceivedPurchaseValueInRange(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
): Promise<{ total: number; poCount: number }> {
  const grns = await prisma.gRN.findMany({
    where: {
      receivedAt: { gte, lte },
      dispatch: {
        po: {
          franchiseStoreId: storeFilter,
          status: { in: [...RECEIVED_PO_STATUSES] },
        },
      },
    },
    include: {
      dispatch: {
        include: {
          po: { include: { items: true } },
        },
      },
    },
  });

  const countedPoIds = new Set<string>();
  let total = 0;

  for (const grn of grns) {
    const po = grn.dispatch?.po;
    if (!po || countedPoIds.has(po.id)) continue;
    countedPoIds.add(po.id);
    total += sumReceivedPoValue([po]);
  }

  const legacyPos = await prisma.purchaseOrder.findMany({
    where: {
      franchiseStoreId: storeFilter,
      status: { in: [...RECEIVED_PO_STATUSES] },
      updatedAt: { gte, lte },
      id: { notIn: [...countedPoIds] },
      OR: [{ dispatch: { is: null } }, { dispatch: { grn: { is: null } } }],
    },
    include: { items: true },
  });

  for (const po of legacyPos) {
    countedPoIds.add(po.id);
    total += sumReceivedPoValue([po]);
  }

  return { total: round2(total), poCount: countedPoIds.size };
}

/** POs received (GRN date or legacy finalize) in range — for purchase summary reports. */
export async function findPosReceivedInRange(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const grns = await prisma.gRN.findMany({
    where: {
      receivedAt: { gte, lte },
      dispatch: {
        po: {
          franchiseStoreId: storeFilter,
          status: { in: [...RECEIVED_PO_STATUSES] },
        },
      },
    },
    include: {
      dispatch: {
        include: {
          po: {
            include: { items: { include: { product: { select: { id: true, name: true } } } } },
          },
        },
      },
    },
  });

  const byId = new Map<string, (typeof grns)[0]['dispatch']['po']>();
  for (const grn of grns) {
    const po = grn.dispatch?.po;
    if (po) byId.set(po.id, po);
  }

  const legacyPos = await prisma.purchaseOrder.findMany({
    where: {
      franchiseStoreId: storeFilter,
      status: { in: [...RECEIVED_PO_STATUSES] },
      updatedAt: { gte, lte },
      id: { notIn: [...byId.keys()] },
      OR: [{ dispatch: { is: null } }, { dispatch: { grn: { is: null } } }],
    },
    include: { items: { include: { product: { select: { id: true, name: true } } } } },
  });

  for (const po of legacyPos) {
    byId.set(po.id, po);
  }

  return { pos: [...byId.values()], poCount: byId.size };
}
