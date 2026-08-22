// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { salesInDateRangeWhere } from '@azela-pos/shared';
import { analyticsService } from '../../services/analyticsService.js';
import { round2, wastagePct, inventoryTurnover } from '../shared/metrics.js';
import { paginateArray, parsePagination } from '../shared/pagination.js';

type StoreFilter = string | { in: string[] };

async function getProductStockMap(storeFilter: StoreFilter) {
  const ledgers = await prisma.inventoryLedger.groupBy({
    by: ['productId', 'type'],
    where: { storeId: storeFilter },
    _sum: { qtyKg: true, qtyPcs: true },
  });

  const stock = new Map<string, { qtyKg: number; qtyPcs: number }>();
  for (const row of ledgers) {
    let s = stock.get(row.productId) || { qtyKg: 0, qtyPcs: 0 };
    const kg = row._sum.qtyKg ?? 0;
    const pcs = row._sum.qtyPcs ?? 0;
    if (row.type === 'IN') {
      s.qtyKg += kg;
      s.qtyPcs += pcs;
    } else {
      s.qtyKg -= kg;
      s.qtyPcs -= pcs;
    }
    stock.set(row.productId, s);
  }
  return stock;
}

export async function getStockSummary(storeFilter: StoreFilter) {
  const stockMap = await getProductStockMap(storeFilter);
  const productIds = [...stockMap.keys()];
  if (productIds.length === 0) return { products: [], totalValue: 0 };

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, unitType: true, categoryId: true },
  });

  const costEntries = await Promise.all(
    productIds.map(async (id) => [id, await analyticsService.calculateAverageCost(id)] as const)
  );
  const costMap = new Map(costEntries);

  let totalValue = 0;
  const rows = products.map((p) => {
    const s = stockMap.get(p.id) || { qtyKg: 0, qtyPcs: 0 };
    const avgCost = costMap.get(p.id) ?? 0;
    const qty = p.unitType === 'PCS' ? s.qtyPcs || s.qtyKg : s.qtyKg || s.qtyPcs;
    const value = round2(qty * avgCost);
    totalValue += value;
    return {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      unitType: p.unitType,
      qtyKg: round2(s.qtyKg),
      qtyPcs: s.qtyPcs,
      avgCost: avgCost > 0 ? round2(avgCost) : null,
      stockValue: value,
    };
  });

  return { products: rows.sort((a, b) => b.stockValue - a.stockValue), totalValue: round2(totalValue) };
}

export async function getStockMovement(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  pagination: { page?: number; pageSize?: number }
) {
  const { skip, take, page, pageSize } = parsePagination(pagination);
  const where = { storeId: storeFilter, createdAt: { gte, lte } };

  const [total, rows] = await Promise.all([
    prisma.inventoryLedger.count({ where }),
    prisma.inventoryLedger.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    sku: r.product.sku,
    type: r.type,
    reason: r.reason,
    qtyKg: r.qtyKg,
    qtyPcs: r.qtyPcs,
    refId: r.refId,
    createdAt: r.createdAt.toISOString(),
  }));

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getStockValuation(storeFilter: StoreFilter) {
  return getStockSummary(storeFilter);
}

export async function getLowStock(storeFilter: StoreFilter, threshold = 5) {
  const summary = await getStockSummary(storeFilter);
  const low = summary.products.filter((p) => {
    const qty = p.unitType === 'PCS' ? p.qtyPcs : p.qtyKg;
    return qty <= threshold;
  });
  return { threshold, products: low };
}

export async function getWastageReport(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const wastageRows = await prisma.inventoryLedger.findMany({
    where: {
      storeId: storeFilter,
      reason: 'WASTAGE',
      type: 'OUT',
      createdAt: { gte, lte },
    },
    include: { product: { select: { id: true, name: true, sku: true, unitType: true } } },
  });

  const salesItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        storeId: storeFilter,
        status: 'PAID',
        ...salesInDateRangeWhere(gte, lte),
      },
    },
    select: { productId: true, qtyKg: true, qtyPcs: true },
  });

  const salesByProduct = new Map<string, number>();
  for (const si of salesItems) {
    const prev = salesByProduct.get(si.productId) || 0;
    salesByProduct.set(si.productId, prev + (si.qtyKg ?? si.qtyPcs ?? 0));
  }

  const byProduct = new Map<string, any>();
  for (const w of wastageRows) {
    let row = byProduct.get(w.productId);
    if (!row) {
      row = {
        productId: w.productId,
        productName: w.product.name,
        sku: w.product.sku,
        unitType: w.product.unitType,
        wastageQty: 0,
        salesQty: salesByProduct.get(w.productId) || 0,
      };
      byProduct.set(w.productId, row);
    }
    row.wastageQty += w.qtyKg ?? w.qtyPcs ?? 0;
  }

  const products = [...byProduct.values()].map((p) => ({
    ...p,
    wastageQty: round2(p.wastageQty),
    wastagePct: wastagePct(p.wastageQty, p.salesQty),
  }));

  const dailyClosings = await prisma.dailyClosing.findMany({
    where: { storeId: storeFilter, closingDate: { gte, lte } },
    select: { closingDate: true, totalWastageKg: true },
  });

  return {
    products: products.sort((a, b) => b.wastageQty - a.wastageQty),
    dailyWastage: dailyClosings.map((d) => ({
      date: d.closingDate.toISOString().slice(0, 10),
      totalWastageKg: d.totalWastageKg,
    })),
    totalWastageKg: round2(products.reduce((s, p) => s + p.wastageQty, 0)),
  };
}

export async function getInventoryVariance(storeFilter: StoreFilter, closingDate?: Date) {
  const latest = closingDate
    ? await prisma.dailyClosing.findFirst({
        where: { storeId: storeFilter, closingDate: { lte: closingDate } },
        orderBy: { closingDate: 'desc' },
      })
    : await prisma.dailyClosing.findFirst({
        where: { storeId: storeFilter },
        orderBy: { closingDate: 'desc' },
      });

  if (!latest?.closingStockJson) {
    return { closingDate: null, variances: [], message: 'No daily closing stock snapshot found' };
  }

  const snapshot = latest.closingStockJson as Record<string, { qtyKg?: number; qtyPcs?: number }>;
  const stockMap = await getProductStockMap(storeFilter);
  const productIds = [...new Set([...Object.keys(snapshot), ...stockMap.keys()])];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, unitType: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const variances = productIds.map((pid) => {
    const p = productMap.get(pid);
    const ledger = stockMap.get(pid) || { qtyKg: 0, qtyPcs: 0 };
    const snap = snapshot[pid] || { qtyKg: 0, qtyPcs: 0 };
    const ledgerQty = p?.unitType === 'PCS' ? ledger.qtyPcs : ledger.qtyKg;
    const snapQty = p?.unitType === 'PCS' ? (snap.qtyPcs ?? 0) : (snap.qtyKg ?? 0);
    return {
      productId: pid,
      productName: p?.name ?? 'Unknown',
      sku: p?.sku ?? '',
      ledgerQty: round2(ledgerQty),
      closingQty: round2(snapQty),
      variance: round2(ledgerQty - snapQty),
    };
  }).filter((v) => Math.abs(v.variance) > 0.001);

  return {
    closingDate: latest.closingDate.toISOString().slice(0, 10),
    variances: variances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
  };
}

export async function getInventoryTurnover(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const valuation = await getStockSummary(storeFilter);
  const avgInventory = valuation.totalValue;

  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        storeId: storeFilter,
        status: 'PAID',
        ...salesInDateRangeWhere(gte, lte),
      },
    },
    select: { productId: true, qtyKg: true, qtyPcs: true, lineTotal: true, product: { select: { unitType: true } } },
  });

  let cogs = 0;
  for (const item of saleItems) {
    const avgCost = await analyticsService.calculateAverageCost(item.productId);
    if (avgCost <= 0) continue;
    const qty = item.product?.unitType === 'PCS' ? (item.qtyPcs ?? item.qtyKg ?? 0) : (item.qtyKg ?? item.qtyPcs ?? 0);
    cogs += avgCost * qty;
  }
  cogs = round2(cogs);

  const turnover = inventoryTurnover(cogs, avgInventory);
  return {
    cogs,
    avgInventoryValue: avgInventory,
    turnover,
    computable: turnover !== null,
    message: turnover === null ? 'Turnover requires COGS and inventory value' : undefined,
  };
}

export async function getInventoryOverview(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const [stock, wastage, turnover] = await Promise.all([
    getStockSummary(storeFilter),
    getWastageReport(storeFilter, gte, lte),
    getInventoryTurnover(storeFilter, gte, lte),
  ]);
  return {
    totalStockValue: stock.totalValue,
    productCount: stock.products.length,
    totalWastageKg: wastage.totalWastageKg,
    turnover: turnover.turnover,
    turnoverComputable: turnover.computable,
  };
}
