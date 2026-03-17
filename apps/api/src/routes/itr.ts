// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { getUser, requireRole } from '../utils/auth.js';

/** Date range for queries; same logic as reports */
function getDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    const startStr = startDate.split('T')[0];
    const endStr = endDate.split('T')[0];
    const start = new Date(startStr + 'T00:00:00.000Z');
    const end = new Date(endStr + 'T23:59:59.999Z');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const endDefault = new Date();
      endDefault.setUTCHours(23, 59, 59, 999);
      const startDefault = new Date();
      startDefault.setUTCDate(startDefault.getUTCDate() - 365);
      startDefault.setUTCHours(0, 0, 0, 0);
      return { gte: startDefault, lte: endDefault };
    }
    return { gte: start, lte: end };
  }
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCHours(0, 0, 0, 0);
  return { gte: start, lte: end };
}

/** Resolve store IDs for owner (all franchises + owner) or single store */
async function getStoreIdsForOwner(ownerStoreId: string, queryStoreId?: string): Promise<string[]> {
  if (queryStoreId === 'all' || !queryStoreId) {
    const franchises = await prisma.store.findMany({
      where: { type: 'FRANCHISE', parentOwnerStoreId: ownerStoreId },
      select: { id: true },
    });
    return [ownerStoreId, ...franchises.map((f) => f.id)];
  }
  return [queryStoreId];
}

/** Indian tax slab (amount in rupees): 0-4L 0%, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, >24L 30% */
function taxFromSlab(income: number): number {
  const L = 100_000;
  let tax = 0;
  if (income <= 4 * L) return 0;
  if (income > 4 * L) tax += Math.min(income - 4 * L, 4 * L) * 0.05;
  if (income > 8 * L) tax += Math.min(income - 8 * L, 4 * L) * 0.1;
  if (income > 12 * L) tax += Math.min(income - 12 * L, 4 * L) * 0.15;
  if (income > 16 * L) tax += Math.min(income - 16 * L, 4 * L) * 0.2;
  if (income > 20 * L) tax += Math.min(income - 20 * L, 4 * L) * 0.25;
  if (income > 24 * L) tax += (income - 24 * L) * 0.3;
  return Math.round(tax * 100) / 100;
}

/** Compute ITR summary from existing Sale and PurchaseOrder data; no Expense table */
async function computeSummary(
  storeIds: string[],
  dateFilter: { gte: Date; lte: Date }
): Promise<{
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  profit: number;
  presumptiveIncome: number;
  monthlyBreakdown?: Array<{ month: string; sales: number; expenses: number }>;
}> {
  const totalExpenses = 0;

  const [salesAgg, posWithItems] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        storeId: storeIds.length === 1 ? storeIds[0] : { in: storeIds },
        status: 'PAID',
        createdAt: dateFilter,
      },
      _sum: { grandTotal: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        franchiseStoreId: storeIds.length === 1 ? storeIds[0] : { in: storeIds },
        createdAt: dateFilter,
      },
      include: { items: true },
    }),
  ]);

  const totalSales = Math.round((salesAgg._sum.grandTotal ?? 0) * 100) / 100;

  let totalPurchases = 0;
  for (const po of posWithItems) {
    for (const item of po.items) {
      const rate = item.requestedRate ?? 0;
      const qtyKg = item.receivedQtyKg ?? item.qtyKg ?? 0;
      const qtyPcs = item.receivedQtyPcs ?? item.qtyPcs ?? 0;
      totalPurchases += rate * qtyKg + rate * qtyPcs;
    }
  }
  totalPurchases = Math.round(totalPurchases * 100) / 100;

  const profit = Math.round((totalSales - totalPurchases - totalExpenses) * 100) / 100;
  const presumptiveIncome = Math.round(totalSales * 0.06 * 100) / 100;

  const monthlyBreakdown: Array<{ month: string; sales: number; expenses: number }> = [];
  const salesForMonth = await prisma.sale.findMany({
    where: {
      storeId: storeIds.length === 1 ? storeIds[0] : { in: storeIds },
      status: 'PAID',
      createdAt: dateFilter,
    },
    select: { grandTotal: true, createdAt: true },
  });
  const byMonth: Record<string, number> = {};
  for (const s of salesForMonth) {
    const key = s.createdAt.toISOString().slice(0, 7);
    byMonth[key] = (byMonth[key] ?? 0) + (s.grandTotal ?? 0);
  }
  const months = Object.keys(byMonth).sort();
  for (const m of months) {
    const [y, mo] = m.split('-');
    const monthLabel = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
    monthlyBreakdown.push({
      month: monthLabel,
      sales: Math.round((byMonth[m] ?? 0) * 100) / 100,
      expenses: 0,
    });
  }

  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    profit,
    presumptiveIncome,
    monthlyBreakdown,
  };
}

export async function itrRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/summary',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const user = getUser(request);
        const { startDate, endDate, storeId: queryStoreId } = (request.query as any) || {};

        const userStore = await prisma.store.findUnique({
          where: { id: user.storeId },
          select: { id: true, type: true, parentOwnerStoreId: true },
        });
        if (!userStore) {
          reply.code(404).send({ error: 'Store not found' });
          return;
        }

        const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
        let storeIds: string[] = [queryStoreId || user.storeId];
        if (userStore.type === 'OWNER' && (queryStoreId === 'all' || !queryStoreId)) {
          storeIds = await getStoreIdsForOwner(ownerStoreId, queryStoreId);
        }

        const dateFilter = getDateRange(startDate, endDate);
        const summary = await computeSummary(storeIds, dateFilter);
        return summary;
      } catch (err: any) {
        console.error('[ITR] Summary error:', err);
        reply.code(500).send({ error: 'Failed to load ITR summary', details: err.message });
      }
    }
  );

  fastify.post(
    '/calculate',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const user = getUser(request);
        const { startDate, endDate, storeId: queryStoreId } = (request.query as any) || {};
        const body = (request.body as any) || {};
        const method = (body.method || 'NORMAL').toUpperCase();
        if (method !== 'NORMAL' && method !== '44AD') {
          reply.code(400).send({ error: 'method must be NORMAL or 44AD' });
          return;
        }

        const userStore = await prisma.store.findUnique({
          where: { id: user.storeId },
          select: { id: true, type: true, parentOwnerStoreId: true },
        });
        if (!userStore) {
          reply.code(404).send({ error: 'Store not found' });
          return;
        }

        const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
        let storeIds: string[] = [queryStoreId || user.storeId];
        if (userStore.type === 'OWNER' && (queryStoreId === 'all' || !queryStoreId)) {
          storeIds = await getStoreIdsForOwner(ownerStoreId, queryStoreId);
        }

        const dateFilter = getDateRange(startDate, endDate);
        const summary = await computeSummary(storeIds, dateFilter);

        const taxableIncome =
          method === '44AD' ? summary.presumptiveIncome : summary.profit;
        const taxAmount = taxFromSlab(Math.max(0, taxableIncome));

        return {
          ...summary,
          method,
          taxableIncome: Math.round(taxableIncome * 100) / 100,
          taxAmount,
        };
      } catch (err: any) {
        console.error('[ITR] Calculate error:', err);
        reply.code(500).send({ error: 'Failed to calculate tax', details: err.message });
      }
    }
  );
}
