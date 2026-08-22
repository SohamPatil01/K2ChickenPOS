// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { paymentMixChartRows, salesInDateRangeWhere } from '@azela-pos/shared';
import { round2, netProfit, budgetVariancePct } from '../shared/metrics.js';
import { RECEIVED_PO_STATUSES, sumReceivedPoValue } from '../shared/poValue.js';

type StoreFilter = string | { in: string[] };

export async function getRevenueSummary(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const sales = await prisma.sale.findMany({
    where: {
      storeId: storeFilter,
      status: 'PAID',
      ...salesInDateRangeWhere(gte, lte),
    },
    include: { payments: true },
  });

  const grossSales = round2(sales.reduce((s, x) => s + (x.grandTotal || 0), 0));
  const discountTotal = round2(sales.reduce((s, x) => s + (x.discountTotal || 0), 0));
  const taxTotal = round2(sales.reduce((s, x) => s + (x.taxTotal || 0), 0));
  const orderCount = sales.length;

  const refunded = await prisma.sale.aggregate({
    where: {
      storeId: storeFilter,
      status: 'REFUNDED',
      ...salesInDateRangeWhere(gte, lte),
    },
    _sum: { grandTotal: true },
  });
  const refundTotal = round2(refunded._sum.grandTotal ?? 0);
  const netSales = round2(grossSales - refundTotal);

  const paymentRows = sales.flatMap((s) =>
    s.payments.map((p) => ({ method: p.method, amount: p.amount }))
  );
  const paymentMix = paymentMixChartRows(paymentRows);

  return {
    grossSales,
    netSales,
    refundTotal,
    discountTotal,
    taxTotal,
    orderCount,
    aov: orderCount > 0 ? round2(netSales / orderCount) : 0,
    paymentMix,
  };
}

const EMPTY_EXPENSE_REPORT = {
  total: 0,
  count: 0,
  byCategory: [] as { categoryId: string; categoryName: string; total: number; count: number }[],
  items: [] as unknown[],
  expensesAvailable: false,
};

export async function getExpenseReport(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  try {
    const expenses = await prisma.expense.findMany({
      where: {
        storeId: storeFilter,
        status: 'APPROVED',
        expenseDate: { gte, lte },
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });

    const byCategory = new Map<string, { categoryId: string; categoryName: string; total: number; count: number }>();
    let total = 0;
    for (const e of expenses) {
      total += e.amount;
      let row = byCategory.get(e.categoryId);
      if (!row) {
        row = { categoryId: e.categoryId, categoryName: e.category.name, total: 0, count: 0 };
        byCategory.set(e.categoryId, row);
      }
      row.total += e.amount;
      row.count += 1;
    }

    return {
      total: round2(total),
      count: expenses.length,
      byCategory: [...byCategory.values()].map((c) => ({ ...c, total: round2(c.total) })),
      items: expenses.map((e) => ({
        id: e.id,
        amount: e.amount,
        expenseDate: e.expenseDate.toISOString().slice(0, 10),
        category: e.category.name,
        paymentMethod: e.paymentMethod,
        description: e.description,
        receiptRef: e.receiptRef,
        createdBy: e.createdBy.name,
      })),
      expensesAvailable: true,
    };
  } catch {
    return EMPTY_EXPENSE_REPORT;
  }
}

export async function getBudgetVsActual(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  try {
    const budgets = await prisma.budget.findMany({
      where: {
        storeId: storeFilter,
        status: 'ACTIVE',
        startDate: { lte: lte },
        endDate: { gte: gte },
      },
      include: { category: { select: { id: true, name: true } } },
    });

    const expenseReport = await getExpenseReport(storeFilter, gte, lte);
    const expenseByCategory = new Map(expenseReport.byCategory.map((c) => [c.categoryId, c.total]));

    const rows = budgets.map((b) => {
      const actual = b.categoryId
        ? expenseByCategory.get(b.categoryId) ?? 0
        : expenseReport.total;
      return {
        budgetId: b.id,
        name: b.name,
        category: b.category?.name ?? 'All',
        budgetAmount: round2(b.amount),
        actual: round2(actual),
        variance: round2(actual - b.amount),
        variancePct: budgetVariancePct(actual, b.amount),
        periodType: b.periodType,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
      };
    });

    return { budgets: rows, expensesAvailable: expenseReport.expensesAvailable };
  } catch {
    return { budgets: [], expensesAvailable: false };
  }
}

export async function getCashFlowReport(storeFilter: StoreFilter, gte: Date, lte: Date) {
  const closings = await prisma.dailyClosing.findMany({
    where: { storeId: storeFilter, closingDate: { gte, lte } },
    orderBy: { closingDate: 'asc' },
  });

  const shifts = await prisma.shift.findMany({
    where: { storeId: storeFilter, openedAt: { gte, lte } },
    select: {
      id: true,
      openedAt: true,
      closedAt: true,
      openingCash: true,
      closingCash: true,
    },
  });

  const daily = closings.map((c) => ({
    date: c.closingDate.toISOString().slice(0, 10),
    cashSales: c.cashSales,
    cardSales: c.cardSales,
    upiSales: c.upiSales,
    cashExpected: c.cashExpected,
    cashDifference: c.cashDifference,
    closingCash: c.closingCash,
    totalRevenue: c.totalRevenue,
  }));

  const totals = {
    cashSales: round2(daily.reduce((s, d) => s + d.cashSales, 0)),
    cardSales: round2(daily.reduce((s, d) => s + d.cardSales, 0)),
    upiSales: round2(daily.reduce((s, d) => s + d.upiSales, 0)),
    totalRevenue: round2(daily.reduce((s, d) => s + d.totalRevenue, 0)),
    netCashDifference: round2(daily.reduce((s, d) => s + d.cashDifference, 0)),
  };

  return { daily, totals, shiftCount: shifts.length };
}

export async function getFinancialSummary(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const [revenue, expenses, purchaseAgg] = await Promise.all([
    getRevenueSummary(storeFilter, gte, lte),
    getExpenseReport(storeFilter, gte, lte),
    prisma.purchaseOrder.findMany({
      where: {
        franchiseStoreId: storeFilter,
        status: { in: [...RECEIVED_PO_STATUSES] },
        createdAt: { gte, lte },
      },
      include: { items: true },
    }),
  ]);

  const totalPurchases = sumReceivedPoValue(purchaseAgg);

  const profit = netProfit(
    revenue.netSales,
    totalPurchases,
    expenses.expensesAvailable ? expenses.total : 0
  );

  return {
    revenue,
    expenses: { total: expenses.total, count: expenses.count },
    totalPurchases,
    netProfit: profit,
    profitMarginPct: revenue.netSales > 0 ? round2((profit / revenue.netSales) * 100) : 0,
  };
}
