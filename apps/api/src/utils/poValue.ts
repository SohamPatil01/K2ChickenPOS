// @ts-nocheck
import { prisma } from '@azela-pos/db';

/** PO statuses where stock has been received and counted. */
export const RECEIVED_PO_STATUSES = ['RECEIVED', 'CLOSED'] as const;

type StoreFilter = string | { in: string[] };

type PoLine = {
  requestedRate?: number | null;
  receivedQtyKg?: number | null;
  receivedQtyPcs?: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Value of a PO line from received qty only (kg OR pcs, not both). */
export function poLineReceivedValue(item: PoLine): number {
  const rate = item.requestedRate ?? 0;
  if (rate <= 0) return 0;

  const recvKg = item.receivedQtyKg ?? 0;
  const recvPcs = item.receivedQtyPcs ?? 0;
  if (recvKg > 0) return rate * recvKg;
  if (recvPcs > 0) return rate * recvPcs;
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
 * Purchase value received within a calendar range (GRN receivedAt, not PO createdAt).
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
