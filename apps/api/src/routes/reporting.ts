// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { getUser } from '../utils/auth.js';
import { resolveReportingDateRange, DatePreset } from '../reporting/shared/dateRange.js';
import { resolveReportingStoreIds } from '../reporting/shared/storeScope.js';
import { rowsToCsv } from '../reporting/shared/exportCsv.js';
import * as inventory from '../reporting/inventory/inventoryReports.js';
import * as purchasing from '../reporting/purchasing/purchasingReports.js';
import * as financial from '../reporting/financial/financialReports.js';
import * as profitability from '../reporting/profitability/profitabilityReports.js';
import * as customers from '../reporting/customers/customerReports.js';
import * as loyalty from '../reporting/loyalty/loyaltyReports.js';
import * as referrals from '../reporting/referrals/referralReports.js';
import * as staff from '../reporting/staff/staffReports.js';
import * as insights from '../reporting/insights/insightsReports.js';

interface ReportQuery {
  startDate?: string;
  endDate?: string;
  preset?: DatePreset;
  storeId?: string;
  page?: string;
  pageSize?: string;
  productId?: string;
  userId?: string;
  format?: string;
}

async function resolveScope(request: FastifyRequest, reply: FastifyReply) {
  const user = getUser(request);
  const q = request.query as ReportQuery;
  const scope = await resolveReportingStoreIds(user.storeId, user.role, q.storeId);
  if (!scope) {
    reply.code(403).send({ error: 'Forbidden store scope' });
    return null;
  }
  const range = resolveReportingDateRange(q.startDate, q.endDate, q.preset);
  return { user, scope, range, q };
}

function hasRole(user: any, ...roles: string[]): boolean {
  return roles.includes(user.role);
}

function managerGuard(user: any, reply: FastifyReply): boolean {
  if (!hasRole(user, 'OWNER', 'MANAGER')) {
    reply.code(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function cashierInventoryGuard(user: any, reply: FastifyReply): boolean {
  if (!hasRole(user, 'OWNER', 'MANAGER', 'CASHIER')) {
    reply.code(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function reportingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Overview
  fastify.get('/overview', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return insights.getBusinessOverview(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/insights', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return insights.getReportingInsights(
      ctx.scope.storeFilter,
      ctx.range.gte,
      ctx.range.lte,
      ctx.user.storeId
    );
  });

  // Inventory
  fastify.get('/inventory/stock', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !cashierInventoryGuard(ctx.user, reply)) return;
    return inventory.getStockSummary(ctx.scope.storeFilter);
  });

  fastify.get('/inventory/movement', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return inventory.getStockMovement(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte, ctx.q);
  });

  fastify.get('/inventory/valuation', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return inventory.getStockValuation(ctx.scope.storeFilter);
  });

  fastify.get('/inventory/low-stock', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !cashierInventoryGuard(ctx.user, reply)) return;
    return inventory.getLowStock(ctx.scope.storeFilter);
  });

  fastify.get('/inventory/wastage', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return inventory.getWastageReport(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/inventory/variance', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return inventory.getInventoryVariance(ctx.scope.storeFilter);
  });

  fastify.get('/inventory/turnover', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return inventory.getInventoryTurnover(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/inventory/overview', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return inventory.getInventoryOverview(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  // Purchasing
  fastify.get('/purchasing/summary', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return purchasing.getPurchaseSummary(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/purchasing/supplier-performance', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return purchasing.getSupplierPerformance(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/purchasing/price-trends', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return purchasing.getPurchasePriceTrends(
      ctx.scope.storeFilter,
      ctx.range.gte,
      ctx.range.lte,
      ctx.q.productId
    );
  });

  fastify.get('/purchasing/supplier-comparison', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return purchasing.getSupplierComparison(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/purchasing/outstanding', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return purchasing.getOutstandingPayments(ctx.scope.storeFilter);
  });

  // Financial
  fastify.get('/financial/revenue', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return financial.getRevenueSummary(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/financial/expenses', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return financial.getExpenseReport(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/financial/budget-vs-actual', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return financial.getBudgetVsActual(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/financial/cash-flow', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return financial.getCashFlowReport(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/financial/summary', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return financial.getFinancialSummary(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  // Profitability
  fastify.get('/profitability/gross-margin', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return profitability.getGrossProfitSummary(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/profitability/products', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return profitability.getProductProfitability(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/profitability/categories', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return profitability.getCategoryProfitability(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/profitability/contribution', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return profitability.getContributionAnalysis(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/profitability/trend', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return profitability.getProfitabilityTrend(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  // Customers
  fastify.get('/customers/overview', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return customers.getCustomerOverview(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/customers/ltv', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return customers.getCustomerLTV(ctx.scope.storeFilter, ctx.q);
  });

  fastify.get('/customers/retention', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return customers.getRetentionSegments(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/customers/frequency', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return customers.getPurchaseFrequency(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  // Loyalty
  fastify.get('/loyalty/summary', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return loyalty.getLoyaltyPointsSummary(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/loyalty/redemption', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return loyalty.getLoyaltyRedemption(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  // Referrals
  fastify.get('/referrals/performance', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return referrals.getReferralPerformance(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/referrals/top', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return referrals.getTopReferrers(ctx.scope.storeFilter);
  });

  // Staff
  fastify.get('/staff/sales', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    const userId =
      ctx.user.role === 'CASHIER' ? ctx.user.userId : ctx.q.userId;
    return staff.getEmployeeSales(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte, userId);
  });

  fastify.get('/staff/discounts', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return staff.getDiscountReport(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/staff/refunds', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return staff.getRefundReport(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.get('/staff/reconciliation', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    const userId = ctx.user.role === 'CASHIER' ? ctx.user.userId : ctx.q.userId;
    return staff.getCashierReconciliation(
      ctx.scope.storeFilter,
      ctx.range.gte,
      ctx.range.lte,
      userId
    );
  });

  fastify.get('/staff/activity', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return staff.getStaffActivity(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte, ctx.q);
  });

  // Expense categories CRUD
  fastify.get('/expense-categories', async (request, reply) => {
    const user = getUser(request);
    if (!managerGuard(user, reply)) return;
    try {
      return await prisma.expenseCategory.findMany({
        where: { storeId: user.storeId, isActive: true },
        orderBy: { name: 'asc' },
      });
    } catch {
      return [];
    }
  });

  fastify.post('/expense-categories', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER')) {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const body = request.body as { name: string; slug?: string };
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return prisma.expenseCategory.create({
      data: { storeId: user.storeId, name: body.name, slug },
    });
  });

  // Expenses CRUD
  fastify.get('/expenses', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    return financial.getExpenseReport(ctx.scope.storeFilter, ctx.range.gte, ctx.range.lte);
  });

  fastify.post('/expenses', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER', 'MANAGER')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = request.body as any;
    return prisma.expense.create({
      data: {
        storeId: user.storeId,
        categoryId: body.categoryId,
        amount: Number(body.amount),
        expenseDate: new Date(body.expenseDate),
        paymentMethod: body.paymentMethod || 'CASH',
        description: body.description,
        receiptRef: body.receiptRef,
        status: user.role === 'OWNER' ? body.status || 'APPROVED' : 'APPROVED',
        createdByUserId: user.userId,
      },
      include: { category: true },
    });
  });

  fastify.put('/expenses/:id', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER', 'MANAGER')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const existing = await prisma.expense.findFirst({
      where: { id, storeId: user.storeId },
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const body = request.body as any;
    return prisma.expense.update({
      where: { id },
      data: {
        categoryId: body.categoryId,
        amount: body.amount !== undefined ? Number(body.amount) : undefined,
        expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
        paymentMethod: body.paymentMethod,
        description: body.description,
        receiptRef: body.receiptRef,
        status: user.role === 'OWNER' ? body.status : undefined,
      },
      include: { category: true },
    });
  });

  fastify.delete('/expenses/:id', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER')) {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const { id } = request.params as { id: string };
    const existing = await prisma.expense.findFirst({
      where: { id, storeId: user.storeId },
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    // Soft-delete: preserve row, mark rejected (no hard delete)
    return prisma.expense.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  });

  // Budget CRUD
  fastify.get('/budgets', async (request, reply) => {
    const user = getUser(request);
    if (!managerGuard(user, reply)) return;
    try {
      return await prisma.budget.findMany({
        where: { storeId: user.storeId },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { startDate: 'desc' },
      });
    } catch {
      return [];
    }
  });

  fastify.post('/budgets', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER')) {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const body = request.body as any;
    return prisma.budget.create({
      data: {
        storeId: user.storeId,
        name: body.name,
        periodType: body.periodType || 'MONTHLY',
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        categoryId: body.categoryId || null,
        amount: Number(body.amount),
        notes: body.notes,
        status: body.status || 'ACTIVE',
      },
      include: { category: true },
    });
  });

  fastify.put('/budgets/:id', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER')) {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.budget.update({
      where: { id },
      data: {
        name: body.name,
        periodType: body.periodType,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        categoryId: body.categoryId,
        amount: body.amount !== undefined ? Number(body.amount) : undefined,
        notes: body.notes,
        status: body.status,
      },
      include: { category: true },
    });
  });

  fastify.delete('/budgets/:id', async (request, reply) => {
    const user = getUser(request);
    if (!hasRole(user, 'OWNER')) {
      return reply.code(403).send({ error: 'Owner only' });
    }
    const { id } = request.params as { id: string };
    const existing = await prisma.budget.findFirst({
      where: { id, storeId: user.storeId },
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    // Soft-close: preserve budget history (no hard delete)
    return prisma.budget.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  });

  // CSV export helper
  fastify.get('/export/financial/summary', async (request, reply) => {
    const ctx = await resolveScope(request, reply);
    if (!ctx || !managerGuard(ctx.user, reply)) return;
    const data = await financial.getFinancialSummary(
      ctx.scope.storeFilter,
      ctx.range.gte,
      ctx.range.lte
    );
    const csv = rowsToCsv(
      ['Metric', 'Value'],
      [
        ['Net Sales', data.revenue.netSales],
        ['Total Expenses', data.expenses.total],
        ['Total Purchases', data.totalPurchases],
        ['Net Profit', data.netProfit],
        ['Profit Margin %', data.profitMarginPct],
      ]
    );
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="financial-summary.csv"');
    return csv;
  });
}
