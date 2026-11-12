// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { resolveStoreDateRange, salesInDateRangeWhere, tallyPaymentsFromSales, ymdInStoreTz, ymdDaysAgoInStoreTz } from '@azela-pos/shared';
import { requireRole, getUser } from '../utils/auth.js';
import { canAccessStoreResource } from '../utils/storeScope.js';

function getDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return resolveStoreDateRange(startDate, endDate);
  }
  return resolveStoreDateRange(undefined, undefined, 30);
}

function salesInPeriodWhere(dateFilter: { gte: Date; lte: Date }) {
  return salesInDateRangeWhere(dateFilter.gte, dateFilter.lte);
}

function saleRangeWhere(storeId: string | { in: string[] }, dateFilter: { gte: Date; lte: Date }) {
  const storeClause = typeof storeId === 'string' ? { storeId } : { storeId };
  return {
    ...storeClause,
    status: 'PAID',
    ...salesInDateRangeWhere(dateFilter.gte, dateFilter.lte),
  };
}

async function requireOwnerStore(request: any, reply: FastifyReply): Promise<string | null> {
  const user = getUser(request);
  if ((user as any).role !== 'OWNER') {
    reply.code(403).send({ error: 'Forbidden' });
    return null;
  }
  const ownerStoreId = (user as any).storeId;
  const ownerStore = await prisma.store.findUnique({
    where: { id: ownerStoreId },
    select: { id: true, name: true, type: true },
  });
  if (!ownerStore || ownerStore.type !== 'OWNER') {
    reply.code(403).send({ error: 'Access denied. Owner store not found.' });
    return null;
  }
  return ownerStoreId;
}

/** Resolve franchise filter to store ids owned by this HQ owner. */
async function resolveHqStoreIds(
  ownerStoreId: string,
  franchiseId: string | undefined,
  reply: FastifyReply
): Promise<string[] | null> {
  if (franchiseId && franchiseId !== 'all') {
    const allowed = await canAccessStoreResource(ownerStoreId, 'OWNER', franchiseId);
    if (!allowed && franchiseId !== ownerStoreId) {
      reply.code(403).send({ error: 'Franchise not owned by this account' });
      return null;
    }
    return [franchiseId];
  }
  const franchises = await prisma.store.findMany({
    where: { type: 'FRANCHISE', parentOwnerStoreId: ownerStoreId },
    select: { id: true },
  });
  return [ownerStoreId, ...franchises.map((f) => f.id)];
}

const hqAuth = { preHandler: [] as any[] };

export async function franchiseHQRoutes(fastify: FastifyInstance) {
  hqAuth.preHandler = [fastify.authenticate, requireRole('OWNER')];

  fastify.get('/dashboard', hqAuth, async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = (request.query as any) || {};
      const dateFilter = getDateRange(startDate, endDate);
      const ownerStoreId = await requireOwnerStore(request, reply);
      if (!ownerStoreId) return;

      const ownerStore = await prisma.store.findUnique({
        where: { id: ownerStoreId },
        select: { id: true, name: true, type: true },
      });

      const franchises = await prisma.store.findMany({
        where: { type: 'FRANCHISE', parentOwnerStoreId: ownerStoreId },
      });
      const franchiseIds = franchises.map((f) => f.id);
      const allStoreIds = [ownerStoreId, ...franchiseIds];

      const [totalSales, totalRevenue, totalCustomers, franchiseSales, saleItems] = await Promise.all([
        prisma.sale.count({
          where: {
            storeId: { in: allStoreIds },
            status: 'PAID',
            ...salesInPeriodWhere(dateFilter),
          },
        }),
        prisma.sale.aggregate({
          where: {
            storeId: { in: allStoreIds },
            status: 'PAID',
            ...salesInPeriodWhere(dateFilter),
          },
          _sum: { grandTotal: true },
        }),
        prisma.customer.count({
          where: {
            storeId: { in: allStoreIds },
            createdAt: dateFilter,
          },
        }),
        prisma.sale.groupBy({
          by: ['storeId'],
          where: saleRangeWhere({ in: allStoreIds }, dateFilter),
          _count: { id: true },
          _sum: { grandTotal: true },
        }),
        prisma.saleItem.findMany({
          where: {
            sale: saleRangeWhere({ in: allStoreIds }, dateFilter),
          },
          select: {
            lineTotal: true,
          },
        }),
      ]);

      const totalProductSales =
        Math.round(saleItems.reduce((sum: any, item: any) => sum + (item.lineTotal || 0), 0) * 100) / 100;

      const storeBreakdown = await Promise.all(
        [
          { id: ownerStoreId, name: ownerStore!.name, type: 'OWNER' },
          ...franchises.map((f: any) => ({ id: f.id, name: f.name, type: 'FRANCHISE' })),
        ].map(async (store: any) => {
          const sales = await prisma.sale.findMany({
            where: saleRangeWhere(store.id, dateFilter),
          });
          const revenue = Math.round(sales.reduce((sum: any, s: any) => sum + (s.grandTotal || 0), 0) * 100) / 100;
          const customers = await prisma.customer.count({
            where: { storeId: store.id, createdAt: dateFilter },
          });
          return {
            franchiseId: store.id,
            franchiseName: store.name,
            storeType: store.type,
            sales: sales.length,
            revenue,
            customers,
            avgBillValue: sales.length > 0 ? Math.round((revenue / sales.length) * 100) / 100 : 0,
          };
        })
      );

      return {
        summary: {
          totalFranchises: franchises.length,
          totalSales,
          totalRevenue: Math.round((totalRevenue._sum.grandTotal || 0) * 100) / 100,
          totalProductSales,
          totalCustomers,
          avgRevenuePerFranchise:
            franchises.length > 0
              ? Math.round(((totalRevenue._sum.grandTotal || 0) / franchises.length) * 100) / 100
              : 0,
        },
        franchiseBreakdown: storeBreakdown.sort((a: any, b: any) => b.revenue - a.revenue),
        period: {
          startDate: startDate || ymdDaysAgoInStoreTz(30),
          endDate: endDate || ymdInStoreTz(),
        },
      };
    } catch (error: any) {
      console.error('Failed to load HQ dashboard:', error);
      reply.code(500).send({
        error: 'Failed to load HQ dashboard',
        details: error.message || 'Unknown error',
      });
    }
  });

  fastify.get('/sales-monitoring', hqAuth, async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate, franchiseId } = (request.query as any) || {};
      const dateFilter = getDateRange(startDate, endDate);
      const ownerStoreId = await requireOwnerStore(request, reply);
      if (!ownerStoreId) return;

      const storeIds = await resolveHqStoreIds(ownerStoreId, franchiseId, reply);
      if (!storeIds) return;

      const sales = await prisma.sale.findMany({
        where: saleRangeWhere({ in: storeIds }, dateFilter),
        include: {
          store: { select: { id: true, name: true } },
          customer: { select: { name: true, phone: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const dailySales = await prisma.sale.groupBy({
        by: ['storeId', 'createdAt'],
        where: saleRangeWhere({ in: storeIds }, dateFilter),
        _count: { id: true },
        _sum: { grandTotal: true },
      });

      return {
        recentSales: sales,
        dailyTrend: dailySales,
        totalSales: sales.length,
      };
    } catch (error: any) {
      console.error('Failed to load sales monitoring:', error);
      reply.code(500).send({ error: 'Failed to load sales monitoring' });
    }
  });

  fastify.get('/inventory-monitoring', hqAuth, async (request: any, reply: FastifyReply) => {
    try {
      const { franchiseId } = (request.query as any) || {};
      const ownerStoreId = await requireOwnerStore(request, reply);
      if (!ownerStoreId) return;

      const storeIds = await resolveHqStoreIds(ownerStoreId, franchiseId, reply);
      if (!storeIds) return;

      const products = await prisma.product.findMany({
        where: { ownerStoreId, isActive: true },
        include: { category: true },
      });

      const inventoryData = await Promise.all(
        storeIds.map(async (storeId) => {
          const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, name: true },
          });
          const inventory = await Promise.all(
            products.map(async (product) => {
              const ledgers = await prisma.inventoryLedger.findMany({
                where: { productId: product.id, storeId },
              });

              let totalQtyKg = 0;
              let totalQtyPcs = 0;
              for (const ledger of ledgers) {
                if (ledger.type === 'IN') {
                  totalQtyKg = Math.round((totalQtyKg + (ledger.qtyKg || 0)) * 100) / 100;
                  totalQtyPcs = Math.round(totalQtyPcs + (ledger.qtyPcs || 0));
                } else {
                  totalQtyKg = Math.round((totalQtyKg - (ledger.qtyKg || 0)) * 100) / 100;
                  totalQtyPcs = Math.round(totalQtyPcs - (ledger.qtyPcs || 0));
                }
              }

              // Raw ledger totals — do not clamp negatives (INV reconciliation)
              return {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                category: product.category?.name || 'Uncategorized',
                currentQtyKg: Math.round(totalQtyKg * 100) / 100,
                currentQtyPcs: Math.round(totalQtyPcs),
                unitType: product.unitType,
                negativeStock: totalQtyKg < -0.001 || totalQtyPcs < 0,
              };
            })
          );

          return {
            storeId,
            storeName: store?.name || 'Unknown',
            inventory,
          };
        })
      );

      return inventoryData;
    } catch (error: any) {
      console.error('Failed to load inventory monitoring:', error);
      reply.code(500).send({ error: 'Failed to load inventory monitoring', details: error.message });
    }
  });

  fastify.get('/compliance', hqAuth, async (request: any, reply: FastifyReply) => {
    try {
      const ownerStoreId = await requireOwnerStore(request, reply);
      if (!ownerStoreId) return;

      const franchises = await prisma.store.findMany({
        where: { type: 'FRANCHISE', parentOwnerStoreId: ownerStoreId },
        include: {
          users: { where: { isActive: true } },
          _count: { select: { sales: true, customers: true } },
        },
      });

      return franchises.map((franchise) => {
        const hasUsers = franchise.users.length > 0;
        const hasSales = franchise._count.sales > 0;
        const hasCustomers = franchise._count.customers > 0;
        const hasManager = franchise.users.some((u) => u.role === 'MANAGER');
        const hasCashier = franchise.users.some((u) => u.role === 'CASHIER');
        const complianceScore =
          [hasUsers, hasManager, hasCashier, hasSales, hasCustomers].filter(Boolean).length * 20;

        return {
          franchiseId: franchise.id,
          franchiseName: franchise.name,
          complianceScore,
          status:
            complianceScore >= 80 ? 'COMPLIANT' : complianceScore >= 60 ? 'WARNING' : 'NON_COMPLIANT',
          checks: { hasUsers, hasManager, hasCashier, hasSales, hasCustomers },
          userCount: franchise.users.length,
        };
      });
    } catch (error: any) {
      console.error('Failed to load compliance data:', error);
      reply.code(500).send({ error: 'Failed to load compliance data' });
    }
  });

  fastify.get('/payments-commissions', hqAuth, async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate, franchiseId } = (request.query as any) || {};
      const dateFilter = getDateRange(startDate, endDate);
      const ownerStoreId = await requireOwnerStore(request, reply);
      if (!ownerStoreId) return;

      const storeIds = await resolveHqStoreIds(ownerStoreId, franchiseId, reply);
      if (!storeIds) return;

      const COMMISSION_RATE = 0.05;

      const franchisePayments = await Promise.all(
        storeIds.map(async (storeId) => {
          const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, name: true },
          });
          const sales = await prisma.sale.findMany({
            where: {
              storeId,
              status: 'PAID',
              ...salesInDateRangeWhere(dateFilter.gte, dateFilter.lte),
            },
            include: {
              payments: { select: { method: true, amount: true } },
            },
          });

          const totalRevenue = sales.reduce((sum: any, s: any) => sum + Number(s.grandTotal ?? 0), 0);
          const commission = totalRevenue * COMMISSION_RATE;
          const netPayment = totalRevenue - commission;
          const paymentTotals = tallyPaymentsFromSales(sales);
          const paymentBreakdown: Record<string, number> = {
            CASH: paymentTotals.cash,
            UPI: paymentTotals.upi,
            CARD: paymentTotals.card,
          };
          if (paymentTotals.credit > 0) paymentBreakdown.CREDIT = paymentTotals.credit;
          if (paymentTotals.other > 0) paymentBreakdown.OTHER = paymentTotals.other;

          return {
            franchiseId: storeId,
            franchiseName: store?.name || 'Unknown',
            totalRevenue,
            commission,
            netPayment,
            salesCount: sales.length,
            paymentBreakdown,
          };
        })
      );

      const totalRevenue = franchisePayments.reduce((sum: any, p) => sum + p.totalRevenue, 0);
      const totalCommission = franchisePayments.reduce((sum: any, p) => sum + p.commission, 0);

      return {
        summary: {
          totalRevenue,
          totalCommission,
          totalNetPayment: totalRevenue - totalCommission,
          commissionRate: COMMISSION_RATE * 100,
        },
        franchisePayments: franchisePayments.sort((a: any, b: any) => b.totalRevenue - a.totalRevenue),
        period: {
          startDate: startDate || ymdDaysAgoInStoreTz(30),
          endDate: endDate || ymdInStoreTz(),
        },
      };
    } catch (error: any) {
      console.error('Failed to load payments/commissions:', error);
      reply.code(500).send({ error: 'Failed to load payments/commissions' });
    }
  });
}
