import bcrypt from 'bcryptjs';
import { prisma } from '@azela-pos/db';
import {
  businessDateForNow,
  closingDateStorageKey,
  salesInStoreDayWhere,
  tallyPaymentsFromSales,
  tallyToClosingFields,
  ymdInStoreTz,
} from '@azela-pos/shared';

export const DAY_IN_REQUIRED = 'DAY_IN_REQUIRED';
/** Remind to Day Out after this hour (0–23) in Asia/Kolkata. */
export const DAY_OUT_REMINDER_HOUR_IST = 20;

export type MovementTotals = { cashIn: number; cashOut: number };

export function sumMovementTotals(
  movements: Array<{ type: 'IN' | 'OUT' | string; amount: number }>
): MovementTotals {
  let cashIn = 0;
  let cashOut = 0;
  for (const m of movements) {
    const amt = Number(m.amount) || 0;
    if (m.type === 'IN') cashIn += amt;
    else if (m.type === 'OUT') cashOut += amt;
  }
  return {
    cashIn: Math.round(cashIn * 1000) / 1000,
    cashOut: Math.round(cashOut * 1000) / 1000,
  };
}

/** Expected drawer cash at Day Out. */
export function expectedCashAtDayOut(
  openingCash: number,
  cashSales: number,
  cashIn: number,
  cashOut: number
): number {
  return Math.round((openingCash + cashSales + cashIn - cashOut) * 1000) / 1000;
}

export function hourInStoreTz(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  return Number(hour) || 0;
}

export function needsDayOutReminder(
  hasOpenShift: boolean,
  at: Date = new Date(),
  reminderHour = DAY_OUT_REMINDER_HOUR_IST
): boolean {
  return hasOpenShift && hourInStoreTz(at) >= reminderHour;
}

export async function findOpenShift(storeId: string) {
  return prisma.shift.findFirst({
    where: { storeId, closedAt: null },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      cashMovements: {
        orderBy: { createdAt: 'asc' },
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: { openedAt: 'desc' },
  });
}

export async function requireOpenShiftId(storeId: string): Promise<string | null> {
  const open = await prisma.shift.findFirst({
    where: { storeId, closedAt: null },
    select: { id: true },
    orderBy: { openedAt: 'desc' },
  });
  return open?.id ?? null;
}

export async function resolveUserByDayPin(storeId: string, dayPin: string) {
  const pin = String(dayPin || '').trim();
  if (!/^\d{4,8}$/.test(pin)) {
    return { user: null as null | { id: string; name: string; role: string }, reason: 'INVALID_FORMAT' as const };
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { type: true, parentOwnerStoreId: true },
  });

  const storeIds = new Set<string>([storeId]);
  if (store?.type === 'FRANCHISE' && store.parentOwnerStoreId) {
    storeIds.add(store.parentOwnerStoreId);
  } else if (store?.type === 'OWNER') {
    const franchises = await prisma.store.findMany({
      where: { parentOwnerStoreId: storeId, type: 'FRANCHISE' },
      select: { id: true },
    });
    for (const f of franchises) storeIds.add(f.id);
  }

  const candidates = await prisma.user.findMany({
    where: {
      storeId: { in: [...storeIds] },
      isActive: true,
      dayPinHash: { not: null },
      role: { in: ['OWNER', 'MANAGER', 'CASHIER', 'DRIVER'] },
    },
    select: {
      id: true,
      name: true,
      role: true,
      dayPinHash: true,
    },
  });

  if (candidates.length === 0) {
    return { user: null, reason: 'NO_DAY_PIN_CONFIGURED' as const };
  }

  for (const u of candidates) {
    if (u.dayPinHash && (await bcrypt.compare(pin, u.dayPinHash))) {
      return { user: { id: u.id, name: u.name, role: u.role }, reason: null };
    }
  }
  return { user: null, reason: 'INVALID_DAY_PIN' as const };
}

export async function lastClosedShiftCarry(storeId: string): Promise<number> {
  const last = await prisma.shift.findFirst({
    where: { storeId, closedAt: { not: null } },
    orderBy: { closedAt: 'desc' },
    select: { pettyCashCarryForward: true },
  });
  return Number(last?.pettyCashCarryForward ?? 0) || 0;
}

export async function tallyShiftDaySales(storeId: string, businessYmd: string) {
  const sales = await prisma.sale.findMany({
    where: salesInStoreDayWhere(storeId, businessYmd, 'PAID'),
    include: {
      items: { include: { product: true } },
      payments: true,
    },
  });

  const paymentTotals = tallyPaymentsFromSales(sales);
  const closingFields = tallyToClosingFields(paymentTotals);

  let totalWeightSoldKg = 0;
  let totalWastageKg = 0;
  let totalDiscounts = 0;
  let totalTax = 0;
  let totalRevenue = 0;

  for (const sale of sales) {
    totalDiscounts += sale.discountTotal || 0;
    totalTax += sale.taxTotal || 0;
    totalRevenue += sale.grandTotal || 0;
    for (const item of sale.items) {
      totalWeightSoldKg += item.qtyKg || 0;
    }
  }

  return {
    sales,
    totalSales: sales.length,
    totalRevenue: Math.round(totalRevenue * 1000) / 1000,
    totalDiscounts: Math.round(totalDiscounts * 1000) / 1000,
    totalTax: Math.round(totalTax * 1000) / 1000,
    totalWeightSoldKg: Math.round(totalWeightSoldKg * 1000) / 1000,
    totalWastageKg,
    cashSales: closingFields.cashSales,
    cardSales: closingFields.cardSales,
    upiSales: closingFields.upiSales,
    creditSales: Math.round((paymentTotals.credit || 0) * 1000) / 1000,
  };
}

export function serializeShift(shift: any, extras: Record<string, unknown> = {}) {
  const movements = shift.cashMovements || [];
  const { cashIn, cashOut } = sumMovementTotals(movements);
  return {
    id: shift.id,
    storeId: shift.storeId,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    openingCash: shift.openingCash,
    closingCash: shift.closingCash,
    cashTakenHome: shift.cashTakenHome,
    pettyCashCarryForward: shift.pettyCashCarryForward,
    overrideReason: shift.overrideReason,
    notes: shift.notes,
    businessDate: shift.businessDate,
    openedBy: shift.openedBy,
    closedBy: shift.closedBy,
    movements: movements.map((m: any) => ({
      id: m.id,
      type: m.type,
      amount: m.amount,
      reason: m.reason,
      createdAt: m.createdAt,
      createdBy: m.createdBy,
    })),
    cashInTotal: cashIn,
    cashOutTotal: cashOut,
    ...extras,
  };
}

export { businessDateForNow, closingDateStorageKey, ymdInStoreTz };
