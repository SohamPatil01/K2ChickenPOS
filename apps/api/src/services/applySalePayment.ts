// @ts-nocheck
import { prisma, PaymentMethod, Prisma } from '@azela-pos/db';
import { awardSaleLoyaltyEarn } from '../lib/loyalty.js';
import { customerWithAreaInclude } from '../utils/customerArea.js';
import { ensureInventoryDeductedForSale } from '../utils/saleItemLedger.js';

async function loadProductUnitTypes(productIds: string[]) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map<string, 'KG' | 'PCS'>();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, unitType: true },
  });
  return new Map(rows.map((r) => [r.id, r.unitType]));
}

function sumPaymentAmounts(paymentList: Array<{ method?: string; amount?: number }>) {
  let actual = 0;
  let credit = 0;
  for (const p of paymentList || []) {
    const amt = Number(p.amount) || 0;
    if (String(p.method || '').toUpperCase() === 'CREDIT') {
      credit += amt;
    } else {
      actual += amt;
    }
  }
  return { actual: Math.round(actual), credit: Math.round(credit) };
}

async function loadSaleFull(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: { include: { product: true } },
      payments: true,
      customer: customerWithAreaInclude,
    },
  });
}

export type ApplyPaymentsInput = {
  saleId: string;
  payments: Array<{ method: string; amount: number; txnRef?: string | null }>;
  actorUserId: string;
  actorStoreId: string;
  /** Inventory was already synced during sale create — skip the pay-time ledger pass. */
  skipInventorySync?: boolean;
  /** Client retry key — when set, duplicate /pay calls return the existing sale. */
  paymentAttemptId?: string | null;
  /** Skip re-fetch when caller just created the sale in the same request. */
  existingSale?: {
    id: string;
    status: string;
    grandTotal: number;
    storeId: string;
    saleNo?: string;
    customerId?: string | null;
    items: any[];
    payments?: any[];
  };
  /** Fresh create already gated overrides — skip an extra DB round-trip. */
  skipDiscountOverrideCheck?: boolean;
};

/**
 * Record payments on an OPEN (or credit) sale and return the updated row.
 * Locks the sale row inside a transaction, rechecks outstanding, and uses
 * unique (saleId, txnRef) for attempt idempotency.
 */
export async function applyPaymentsToSale(input: ApplyPaymentsInput) {
  const {
    saleId,
    payments,
    actorUserId,
    actorStoreId,
    skipInventorySync,
    paymentAttemptId,
    skipDiscountOverrideCheck,
  } = input;

  const attemptKey = paymentAttemptId ? String(paymentAttemptId).trim().slice(0, 64) : '';

  if (!skipDiscountOverrideCheck) {
    try {
      const discountOverride = await (prisma as any).discountOverride
        ?.findFirst({ where: { saleId } })
        .catch(() => null);
      if (discountOverride?.status === 'PENDING') {
        const err: any = new Error(
          'Discount override is pending approval. Please wait for manager approval before processing payment.'
        );
        err.statusCode = 400;
        err.requiresApproval = true;
        throw err;
      }
    } catch (err: any) {
      if (err.requiresApproval) throw err;
    }
  }

  const validPaymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE'];
  for (const p of payments) {
    const methodStr = String(p.method || '').toUpperCase().trim();
    if (!validPaymentMethods.includes(methodStr as PaymentMethod)) {
      const err: any = new Error(`Invalid payment method: "${p.method}"`);
      err.statusCode = 400;
      throw err;
    }
    const amount = Number(p.amount);
    if (Number.isNaN(amount) || !Number.isFinite(amount) || amount < 0) {
      const err: any = new Error('Invalid payment amount');
      err.statusCode = 400;
      throw err;
    }
  }

  let becameSettled = false;
  let saleMeta: {
    storeId: string;
    saleNo?: string;
    customerId?: string | null;
    grandTotal: number;
    items: any[];
    priorStatus: string;
    priorActual: number;
  } | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // Row lock — serializes concurrent /pay against the same sale
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;

      if (attemptKey) {
        const already = await tx.payment.findFirst({
          where: {
            saleId,
            txnRef: { startsWith: `attempt:${attemptKey}` },
          },
          select: { id: true },
        });
        if (already) {
          return; // idempotent hit — caller loads full sale after txn
        }
      }

      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true, payments: true },
      });

      if (!sale) {
        const err: any = new Error('Sale not found');
        err.statusCode = 404;
        throw err;
      }

      if (sale.status === 'VOID' || sale.status === 'REFUNDED') {
        const err: any = new Error('Sale is cancelled and cannot accept payments');
        err.statusCode = 400;
        throw err;
      }

      const existingPayments = sale.payments || [];
      const hasCreditPayment = existingPayments.some((p) => p.method === 'CREDIT');

      if (sale.status !== 'OPEN' && !hasCreditPayment) {
        const err: any = new Error('Sale is not open and cannot accept additional payments');
        err.statusCode = 400;
        throw err;
      }

      const existingSums = sumPaymentAmounts(existingPayments);
      const incomingSums = sumPaymentAmounts(payments);
      const roundedGrandTotal = Math.round(sale.grandTotal);
      const newActualTotal = existingSums.actual + incomingSums.actual;
      const newCreditTotal = existingSums.credit + incomingSums.credit;
      const newPaymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const hasNewCreditPayment = payments.some((p) => String(p.method).toUpperCase() === 'CREDIT');
      const hasAnyCreditPayment = hasCreditPayment || hasNewCreditPayment;

      if (sale.status === 'OPEN' || hasAnyCreditPayment) {
        if (newActualTotal > roundedGrandTotal + 0.5) {
          const idempotent =
            incomingSums.actual > 0 && existingSums.actual >= roundedGrandTotal - 0.5;
          if (idempotent) return;
          const err: any = new Error('Payment amount exceeds remaining balance');
          err.statusCode = 400;
          throw err;
        }
        if (
          incomingSums.credit > 0 &&
          incomingSums.actual === 0 &&
          existingSums.credit >= roundedGrandTotal - 0.5
        ) {
          return;
        }
        if (newCreditTotal > roundedGrandTotal + 0.5) {
          if (existingSums.credit >= roundedGrandTotal - 0.5) return;
          const err: any = new Error('Credit amount exceeds bill total');
          err.statusCode = 400;
          throw err;
        }
      } else if (Math.abs(newPaymentsTotal - roundedGrandTotal) > 0.5) {
        const err: any = new Error('Payment amount mismatch');
        err.statusCode = 400;
        throw err;
      }

      const paymentData = payments.map((p) => {
        const methodStr = String(p.method || '').toUpperCase().trim() as PaymentMethod;
        return {
          saleId,
          method: methodStr,
          amount: Number(p.amount),
          txnRef: p.txnRef || (attemptKey ? `attempt:${attemptKey}:${methodStr}` : null),
        };
      });

      const paymentsToCreate = paymentData.filter((p) => p.amount > 0);
      const isSettledWithActual = newActualTotal >= roundedGrandTotal - 0.5;
      const isCreditOnlyBooked =
        hasAnyCreditPayment &&
        newActualTotal < roundedGrandTotal - 0.5 &&
        newCreditTotal >= roundedGrandTotal - 0.5;

      let saleStatus = sale.status;
      if (isSettledWithActual) {
        saleStatus = 'PAID';
      } else if (isCreditOnlyBooked || sale.status === 'OPEN') {
        saleStatus = 'OPEN';
      }

      if (paymentsToCreate.length > 0) {
        await tx.payment.createMany({ data: paymentsToCreate });
      }
      await tx.sale.update({
        where: { id: saleId },
        data: { status: saleStatus },
      });

      becameSettled =
        isSettledWithActual &&
        sale.status !== 'PAID' &&
        existingSums.actual < Math.round(sale.grandTotal) - 0.5;

      saleMeta = {
        storeId: sale.storeId,
        saleNo: sale.saleNo,
        customerId: sale.customerId,
        grandTotal: sale.grandTotal,
        items: sale.items,
        priorStatus: sale.status,
        priorActual: existingSums.actual,
      };
    });
  } catch (err: any) {
    // Unique (saleId, txnRef) — concurrent retry with same attempt key
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attemptKey) {
      const existing = await loadSaleFull(saleId);
      if (existing) return existing;
    }
    throw err;
  }

  const updatedSale = await loadSaleFull(saleId);
  if (!updatedSale) {
    const err: any = new Error('Sale not found after payment');
    err.statusCode = 404;
    throw err;
  }

  // Idempotent hit with no new writes still returns the current sale
  if (!saleMeta) {
    return updatedSale;
  }

  if (!skipInventorySync) {
    const unitMapPay = await loadProductUnitTypes(saleMeta.items.map((i) => i.productId));
    try {
      await ensureInventoryDeductedForSale(
        prisma,
        saleId,
        saleMeta.storeId,
        saleMeta.items,
        unitMapPay
      );
    } catch (inventoryError: any) {
      console.error('[Payment] Inventory sync failed for sale:', saleId, inventoryError);
      throw inventoryError;
    }
  }

  if (saleMeta.customerId && becameSettled) {
    try {
      await awardSaleLoyaltyEarn(prisma, {
        saleId,
        saleNo: saleMeta.saleNo,
        customerId: saleMeta.customerId,
        storeId: saleMeta.storeId,
        grandTotal: saleMeta.grandTotal,
        userId: actorUserId,
      });
    } catch (err) {
      console.warn('[Payment] Loyalty award failed:', err);
    }
  }

  void prisma.auditLog
    .create({
      data: {
        storeId: saleMeta.storeId,
        actorUserId,
        action: 'SALE_PAID',
        entityType: 'Sale',
        entityId: saleId,
        metaJson: { payments, userStoreId: actorStoreId },
      },
    })
    .catch((err) => console.warn('[Payment] Audit log failed (non-critical):', err));

  return updatedSale;
}
