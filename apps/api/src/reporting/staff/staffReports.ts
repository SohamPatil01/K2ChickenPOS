// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { salesInDateRangeWhere } from '@azela-pos/shared';
import { round2 } from '../shared/metrics.js';
import { parsePagination } from '../shared/pagination.js';

type StoreFilter = string | { in: string[] };

export async function getEmployeeSales(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  userId?: string
) {
  const sales = await prisma.sale.groupBy({
    by: ['createdByUserId'],
    where: {
      storeId: storeFilter,
      status: 'PAID',
      ...(userId ? { createdByUserId: userId } : {}),
      ...salesInDateRangeWhere(gte, lte),
    },
    _sum: { grandTotal: true, discountTotal: true },
    _count: true,
  });

  const userIds = sales.map((s) => s.createdByUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    employees: sales
      .map((s) => ({
        userId: s.createdByUserId,
        name: userMap.get(s.createdByUserId)?.name ?? 'Unknown',
        role: userMap.get(s.createdByUserId)?.role ?? '',
        orderCount: s._count,
        revenue: round2(s._sum.grandTotal ?? 0),
        discounts: round2(s._sum.discountTotal ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export async function getDiscountReport(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const sales = await prisma.sale.findMany({
    where: {
      storeId: storeFilter,
      status: 'PAID',
      discountTotal: { gt: 0 },
      ...salesInDateRangeWhere(gte, lte),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { discountTotal: 'desc' },
  });

  const overrides = await prisma.discountOverride.findMany({
    where: { storeId: storeFilter, createdAt: { gte, lte } },
    include: {
      requester: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
  });

  return {
    totalDiscounts: round2(sales.reduce((s, x) => s + (x.discountTotal || 0), 0)),
    discountedOrders: sales.length,
    sales: sales.slice(0, 100).map((s) => ({
      saleId: s.id,
      saleNo: s.saleNo,
      discountTotal: s.discountTotal,
      grandTotal: s.grandTotal,
      cashier: s.createdBy?.name,
      customer: s.customer?.name,
      date: (s.businessDate ?? s.createdAt).toISOString().slice(0, 10),
    })),
    overrides: overrides.map((o) => ({
      id: o.id,
      saleId: o.saleId,
      requestedDiscount: o.overrideDiscount,
      status: o.status,
      requester: o.requester?.name,
      approver: o.approver?.name,
      reason: o.reason,
    })),
  };
}

export async function getRefundReport(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const voided = await prisma.sale.findMany({
    where: {
      storeId: storeFilter,
      status: { in: ['VOID', 'REFUNDED'] },
      ...salesInDateRangeWhere(gte, lte),
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    count: voided.length,
    totalValue: round2(voided.reduce((s, x) => s + (x.grandTotal || 0), 0)),
    items: voided.map((s) => ({
      saleId: s.id,
      saleNo: s.saleNo,
      status: s.status,
      grandTotal: s.grandTotal,
      cashier: s.createdBy?.name,
      date: (s.businessDate ?? s.createdAt).toISOString().slice(0, 10),
    })),
  };
}

export async function getCashierReconciliation(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  userId?: string
) {
  const shifts = await prisma.shift.findMany({
    where: {
      storeId: storeFilter,
      openedAt: { gte, lte },
      ...(userId ? { openedByUserId: userId } : {}),
    },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      dailyClosings: true,
    },
    orderBy: { openedAt: 'desc' },
  });

  return {
    shifts: shifts.map((s) => {
      const closing = s.dailyClosings[0];
      return {
        shiftId: s.id,
        openedBy: s.openedBy.name,
        closedBy: s.closedBy?.name ?? null,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
        openingCash: s.openingCash,
        closingCash: s.closingCash,
        cashDifference: closing?.cashDifference ?? null,
        totalRevenue: closing?.totalRevenue ?? null,
      };
    }),
  };
}

export async function getStaffActivity(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  pagination: { page?: number; pageSize?: number }
) {
  const { skip, take, page, pageSize } = parsePagination(pagination);
  const where = { storeId: storeFilter, createdAt: { gte, lte } };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    items: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      userId: l.actorUserId,
      userName: l.actor?.name,
      userRole: l.actor?.role,
      details: l.metaJson,
      createdAt: l.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}
