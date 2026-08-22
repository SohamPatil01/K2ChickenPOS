// @ts-nocheck
import { round2 } from './metrics.js';

/** PO statuses where stock has been received and counted. */
export const RECEIVED_PO_STATUSES = ['RECEIVED', 'CLOSED'] as const;

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
