// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { salesInDateRangeWhere, ymdDaysAgoInStoreTz } from '@azela-pos/shared';
import { round2, ltv, retentionRate, aov } from '../shared/metrics.js';

type StoreFilter = string | { in: string[] };

export async function getCustomerOverview(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const [totalCustomers, activeCustomers, newCustomers] = await Promise.all([
    prisma.customer.count({ where: { storeId: storeFilter } }),
    prisma.customer.count({
      where: {
        storeId: storeFilter,
        sales: {
          some: {
            status: 'PAID',
            ...salesInDateRangeWhere(gte, lte),
          },
        },
      },
    }),
    prisma.customer.count({
      where: {
        storeId: storeFilter,
        createdAt: { gte, lte },
      },
    }),
  ]);

  const revenue = await prisma.sale.aggregate({
    where: {
      storeId: storeFilter,
      status: 'PAID',
      customerId: { not: null },
      ...salesInDateRangeWhere(gte, lte),
    },
    _sum: { grandTotal: true },
    _count: true,
  });

  return {
    totalCustomers,
    activeCustomers,
    newCustomers,
    customerRevenue: round2(revenue._sum.grandTotal ?? 0),
    customerOrders: revenue._count,
    aov: aov(revenue._sum.grandTotal ?? 0, revenue._count),
  };
}

export async function getCustomerLTV(
  storeFilter: StoreFilter,
  pagination: { page?: number; pageSize?: number }
) {
  const pageSize = Math.min(500, Math.max(1, Number(pagination.pageSize) || 50));
  const page = Math.max(1, Number(pagination.page) || 1);
  const skip = (page - 1) * pageSize;

  const customers = await prisma.customer.findMany({
    where: { storeId: storeFilter },
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      totalSpent: true,
      createdAt: true,
      _count: { select: { sales: { where: { status: 'PAID' } } } },
    },
    orderBy: { totalSpent: 'desc' },
    skip,
    take: pageSize,
  });

  const total = await prisma.customer.count({ where: { storeId: storeFilter } });

  return {
    customers: customers.map((c) => ({
      customerId: c.id,
      name: c.name,
      phone: c.phone,
      ltv: ltv(c.totalSpent),
      orderCount: c._count.sales,
      loyaltyPoints: c.loyaltyPoints,
      memberSince: c.createdAt.toISOString().slice(0, 10),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function getRetentionSegments(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  atRiskDays = 30
) {
  const priorStart = new Date(gte.getTime() - (lte.getTime() - gte.getTime()) - 1);
  const priorEnd = new Date(gte.getTime() - 1);

  const currentBuyers = await prisma.sale.findMany({
    where: {
      storeId: storeFilter,
      status: 'PAID',
      customerId: { not: null },
      ...salesInDateRangeWhere(gte, lte),
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const currentSet = new Set(currentBuyers.map((s) => s.customerId!));

  const priorBuyers = await prisma.sale.findMany({
    where: {
      storeId: storeFilter,
      status: 'PAID',
      customerId: { not: null },
      ...salesInDateRangeWhere(priorStart, priorEnd),
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const priorSet = new Set(priorBuyers.map((s) => s.customerId!));

  let returning = 0;
  for (const id of currentSet) {
    if (priorSet.has(id)) returning += 1;
  }

  const atRiskCutoff = ymdDaysAgoInStoreTz(atRiskDays);
  const atRisk = await prisma.customer.count({
    where: {
      storeId: storeFilter,
      sales: {
        none: {
          status: 'PAID',
          createdAt: { gte: new Date(`${atRiskCutoff}T00:00:00.000+05:30`) },
        },
      },
    },
  });

  return {
    currentPeriodBuyers: currentSet.size,
    priorPeriodBuyers: priorSet.size,
    returningCustomers: returning,
    retentionRate: retentionRate(returning, priorSet.size),
    newCustomers: currentSet.size - returning,
    atRiskCustomers: atRisk,
    atRiskDays,
  };
}

export async function getPurchaseFrequency(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const sales = await prisma.sale.groupBy({
    by: ['customerId'],
    where: {
      storeId: storeFilter,
      status: 'PAID',
      customerId: { not: null },
      ...salesInDateRangeWhere(gte, lte),
    },
    _count: true,
  });

  const frequencies = sales.map((s) => s._count);
  const activeCustomers = frequencies.length;
  const totalOrders = frequencies.reduce((a, b) => a + b, 0);

  const buckets = { one: 0, twoToFive: 0, sixPlus: 0 };
  for (const f of frequencies) {
    if (f === 1) buckets.one += 1;
    else if (f <= 5) buckets.twoToFive += 1;
    else buckets.sixPlus += 1;
  }

  return {
    activeCustomers,
    totalOrders,
    avgFrequency: activeCustomers > 0 ? round2(totalOrders / activeCustomers) : 0,
    buckets,
  };
}
