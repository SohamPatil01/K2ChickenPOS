// @ts-nocheck
import { prisma } from '@azela-pos/db';

export type StoreCreditTxnType = 'SURPLUS' | 'APPLY' | 'ADJUST';

type DbClient = typeof prisma | any;

/**
 * Credit surplus / prepaid amount onto the customer (₹).
 * Full ledger row + optional audit via caller.
 */
export async function creditStoreCredit(
  db: DbClient,
  input: {
    customerId: string;
    storeId: string;
    amount: number;
    type?: StoreCreditTxnType;
    description: string;
    saleId?: string | null;
    actorUserId?: string | null;
  }
): Promise<{ balance: number; credited: number }> {
  const amount = Math.round(Number(input.amount) || 0);
  if (amount <= 0) return { balance: 0, credited: 0 };

  const cust = await db.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, storeCredit: true },
  });
  if (!cust) {
    const err: any = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const prev = Math.round(Number(cust.storeCredit) || 0);
  const balance = prev + amount;

  await db.customer.update({
    where: { id: input.customerId },
    data: { storeCredit: balance },
  });

  await db.storeCreditTransaction.create({
    data: {
      customerId: input.customerId,
      storeId: input.storeId,
      type: input.type || 'SURPLUS',
      amount,
      balance,
      description: input.description,
      saleId: input.saleId || null,
      createdBy: input.actorUserId || null,
    },
  });

  return { balance, credited: amount };
}

/**
 * Apply store credit against a bill (reduces payable). Caps to available + bill.
 */
export async function applyStoreCredit(
  db: DbClient,
  input: {
    customerId: string;
    storeId: string;
    amount: number;
    saleId?: string | null;
    description: string;
    actorUserId?: string | null;
    type?: 'APPLY' | 'ADJUST';
  }
): Promise<{ balance: number; applied: number }> {
  const requested = Math.round(Number(input.amount) || 0);
  if (requested <= 0) return { balance: 0, applied: 0 };

  const cust = await db.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, storeCredit: true },
  });
  if (!cust) {
    const err: any = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const prev = Math.round(Number(cust.storeCredit) || 0);
  const applied = Math.min(requested, prev);
  if (applied <= 0) return { balance: prev, applied: 0 };

  const balance = prev - applied;

  await db.customer.update({
    where: { id: input.customerId },
    data: { storeCredit: balance },
  });

  await db.storeCreditTransaction.create({
    data: {
      customerId: input.customerId,
      storeId: input.storeId,
      type: input.type || 'APPLY',
      amount: -applied,
      balance,
      description: input.description,
      saleId: input.saleId || null,
      createdBy: input.actorUserId || null,
    },
  });

  return { balance, applied };
}

export async function listStoreCreditLedger(customerId: string, take = 50) {
  const [customer, transactions] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phone: true, storeCredit: true },
    }),
    prisma.storeCreditTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        amount: true,
        balance: true,
        description: true,
        saleId: true,
        createdAt: true,
        createdBy: true,
        sale: { select: { saleNo: true } },
      },
    }),
  ]);
  return { customer, transactions };
}
