// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { getUser } from '../utils/auth.js';
import { resolveReportingDateRange } from '../reporting/shared/dateRange.js';
import { resolveFranchiseStoreIds } from '../reporting/shared/storeScope.js';
import * as insights from '../reporting/insights/insightsReports.js';
import * as financial from '../reporting/financial/financialReports.js';
import * as inventory from '../reporting/inventory/inventoryReports.js';
import { prisma } from '@azela-pos/db';

export async function hqReportingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/overview', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const q = request.query as any;
    const range = resolveReportingDateRange(q.startDate, q.endDate, q.preset);
    const storeIds = await resolveFranchiseStoreIds(user.storeId, user.role);
    const storeFilter = storeIds.length === 1 ? storeIds[0]! : { in: storeIds };

    const overview = await insights.getBusinessOverview(storeFilter, range.gte, range.lte);

    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true, type: true },
    });

    const byStore = await Promise.all(
      stores.map(async (s) => {
        const fin = await financial.getFinancialSummary(s.id, range.gte, range.lte);
        return {
          storeId: s.id,
          storeName: s.name,
          type: s.type,
          netSales: fin.revenue.netSales,
          netProfit: fin.netProfit,
          orderCount: fin.revenue.orderCount,
        };
      })
    );

    return { overview, byStore, storeIds, period: { start: range.startYmd, end: range.endYmd } };
  });

  fastify.get('/inventory/overview', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const q = request.query as any;
    const range = resolveReportingDateRange(q.startDate, q.endDate, q.preset);
    const storeIds = await resolveFranchiseStoreIds(user.storeId, user.role);
    const storeFilter = storeIds.length === 1 ? storeIds[0]! : { in: storeIds };
    return inventory.getInventoryOverview(storeFilter, range.gte, range.lte);
  });

  fastify.get('/financial/summary', async (request, reply) => {
    const user = getUser(request);
    if (user.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const q = request.query as any;
    const range = resolveReportingDateRange(q.startDate, q.endDate, q.preset);
    const storeIds = await resolveFranchiseStoreIds(user.storeId, user.role);
    const storeFilter = storeIds.length === 1 ? storeIds[0]! : { in: storeIds };
    return financial.getFinancialSummary(storeFilter, range.gte, range.lte);
  });
}
