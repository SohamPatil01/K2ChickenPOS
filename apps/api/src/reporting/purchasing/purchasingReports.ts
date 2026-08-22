// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { round2, pct, weightedAvgCost } from '../shared/metrics.js';
import { parsePagination } from '../shared/pagination.js';

type StoreFilter = string | { in: string[] };

const CLOSED_PO_STATUSES = ['RECEIVED', 'CLOSED'] as const;
const OPEN_PO_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'DISPATCHED'] as const;

function poLineValue(item: {
  requestedRate?: number | null;
  receivedQtyKg?: number | null;
  receivedQtyPcs?: number | null;
  qtyKg?: number | null;
  qtyPcs?: number | null;
}): number {
  const rate = item.requestedRate ?? 0;
  const qtyKg = item.receivedQtyKg ?? item.qtyKg ?? 0;
  const qtyPcs = item.receivedQtyPcs ?? item.qtyPcs ?? 0;
  return rate * qtyKg + rate * qtyPcs;
}

export async function getPurchaseSummary(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      franchiseStoreId: storeFilter,
      createdAt: { gte, lte },
    },
    include: { items: { include: { product: { select: { id: true, name: true } } } } },
  });

  let totalValue = 0;
  const byStatus: Record<string, number> = {};
  const byProduct = new Map<string, { productId: string; productName: string; qty: number; value: number }>();

  for (const po of pos) {
    byStatus[po.status] = (byStatus[po.status] || 0) + 1;
    for (const item of po.items) {
      const val = poLineValue(item);
      totalValue += val;
      let row = byProduct.get(item.productId);
      if (!row) {
        row = { productId: item.productId, productName: item.product.name, qty: 0, value: 0 };
        byProduct.set(item.productId, row);
      }
      row.qty += item.receivedQtyKg ?? item.qtyKg ?? item.receivedQtyPcs ?? item.qtyPcs ?? 0;
      row.value += val;
    }
  }

  return {
    poCount: pos.length,
    totalValue: round2(totalValue),
    byStatus,
    topProducts: [...byProduct.values()]
      .map((p) => ({ ...p, value: round2(p.value), qty: round2(p.qty) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20),
  };
}

export async function getSupplierPerformance(storeFilter: StoreFilter, gte: Date, lte: Date) {
  const pos = await prisma.purchaseOrder.findMany({
    where: { franchiseStoreId: storeFilter, createdAt: { gte, lte } },
    include: { dispatch: { include: { grn: true } }, items: true },
  });

  const stats = {
    totalPOs: pos.length,
    withDispatch: 0,
    withGRN: 0,
    avgLeadTimeDays: null as number | null,
  };

  const leadTimes: number[] = [];
  for (const po of pos) {
    if (po.dispatch) {
      stats.withDispatch += 1;
      if (po.dispatch.grn) {
        stats.withGRN += 1;
        const leadMs = po.dispatch.grn.receivedAt.getTime() - po.createdAt.getTime();
        leadTimes.push(leadMs / (1000 * 60 * 60 * 24));
      }
    }
  }

  if (leadTimes.length > 0) {
    stats.avgLeadTimeDays = round2(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length);
  }

  return {
    ...stats,
    onTimePct: pos.length > 0 ? pct(stats.withGRN, pos.length) : 0,
    note: 'Supplier linked via HQ CentralPurchaseOrder; franchise POs tracked per store',
  };
}

export async function getPurchasePriceTrends(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  productId?: string
) {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      franchiseStoreId: storeFilter,
      status: { in: [...CLOSED_PO_STATUSES] },
      createdAt: { gte, lte },
      ...(productId ? { items: { some: { productId } } } : {}),
    },
    include: {
      items: {
        where: productId ? { productId } : undefined,
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const series: { date: string; productId: string; productName: string; rate: number }[] = [];
  for (const po of pos) {
    const date = po.createdAt.toISOString().slice(0, 10);
    for (const item of po.items) {
      if (item.requestedRate && item.requestedRate > 0) {
        series.push({
          date,
          productId: item.productId,
          productName: item.product.name,
          rate: round2(item.requestedRate),
        });
      }
    }
  }

  return { series };
}

export async function getSupplierComparison(storeFilter: StoreFilter, gte: Date, lte: Date) {
  const summary = await getPurchaseSummary(storeFilter, gte, lte);
  return {
    products: summary.topProducts,
    note: 'Franchise PO supplier comparison — HQ suppliers on CentralPurchaseOrder',
  };
}

export async function getOutstandingPayments(storeFilter: StoreFilter) {
  const openPos = await prisma.purchaseOrder.findMany({
    where: {
      franchiseStoreId: storeFilter,
      status: { in: [...OPEN_PO_STATUSES] },
    },
    include: { items: true },
  });

  let outstanding = 0;
  const rows = openPos.map((po) => {
    let value = 0;
    for (const item of po.items) value += poLineValue(item);
    outstanding += value;
    return {
      poId: po.id,
      poNo: po.poNo,
      status: po.status,
      value: round2(value),
      createdAt: po.createdAt.toISOString(),
    };
  });

  return {
    outstanding: round2(outstanding),
    openPOCount: openPos.length,
    pos: rows.sort((a, b) => b.value - a.value),
    limitation: 'PO payment status not fully tracked; outstanding estimated from open PO value',
  };
}

export async function getPurchasingOverview(storeFilter: StoreFilter, gte: Date, lte: Date) {
  const [summary, outstanding] = await Promise.all([
    getPurchaseSummary(storeFilter, gte, lte),
    getOutstandingPayments(storeFilter),
  ]);
  return {
    poCount: summary.poCount,
    totalPurchaseValue: summary.totalValue,
    outstanding: outstanding.outstanding,
    openPOCount: outstanding.openPOCount,
  };
}
