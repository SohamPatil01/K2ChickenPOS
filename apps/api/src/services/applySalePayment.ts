// @ts-nocheck
import { prisma, PaymentMethod } from '@azela-pos/db';
import { awardSaleLoyaltyEarn } from '../lib/loyalty.js';
import { customerWithAreaInclude } from './customerArea.js';
import { ensureInventoryDeductedForSale } from './saleItemLedger.js';

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

export type ApplyPaymentsInput = {
  saleId: string;
  payments: Array<{ method: string; amount: number; txnRef?: string | null }>;
  actorUserId: string;
  actorStoreId: string;
  /** Inventory was already synced during sale create — skip the pay-time ledger pass. */
  skipInventorySync?: boolean;
};

/**
 * Record payments on an OPEN (or credit) sale and return the updated row.
 * Shared by POST /sales/:id/pay and inline checkout on POST /sales.
 */
export async function applyPaymentsToSale(input: ApplyPaymentsInput) {
  const { saleId, payments, actorUserId, actorStoreId, skipInventorySync } = input;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      payments: true,
    },
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

  try {
    const discountOverride = await (prisma as any).discountOverride?.findFirst({
      where: { saleId },
    }).catch(() => null);
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
      if (idempotent) {
        return prisma.sale.findUnique({
          where: { id: saleId },
          include: {
            items: { include: { product: true } },
            payments: true,
            customer: customerWithAreaInclude,
          },
        });
      }
      const err: any = new Error('Payment amount exceeds remaining balance');
      err.statusCode = 400;
      throw err;
    }
    if (
      incomingSums.credit > 0 &&
      incomingSums.actual === 0 &&
      existingSums.credit >= roundedGrandTotal - 0.5
    ) {
      return prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: customerWithAreaInclude,
        },
      });
    }
    if (newCreditTotal > roundedGrandTotal + 0.5) {
      if (existingSums.credit >= roundedGrandTotal - 0.5) {
        return prisma.sale.findUnique({
          where: { id: saleId },
          include: {
            items: { include: { product: true } },
            payments: true,
            customer: customerWithAreaInclude,
          },
        });
      }
      const err: any = new Error('Credit amount exceeds bill total');
      err.statusCode = 400;
      throw err;
    }
  } else if (Math.abs(newPaymentsTotal - roundedGrandTotal) > 0.5) {
    const err: any = new Error('Payment amount mismatch');
    err.statusCode = 400;
    throw err;
  }

  const validPaymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE'];
  const paymentData: Array<{
    saleId: string;
    method: PaymentMethod;
    amount: number;
    txnRef: string | null;
  }> = [];

  for (const p of payments) {
    const methodStr = String(p.method || '').toUpperCase().trim();
    if (!validPaymentMethods.includes(methodStr as PaymentMethod)) {
      const err: any = new Error(`Invalid payment method: "${p.method}"`);
      err.statusCode = 400;
      throw err;
    }
    const amount = Number(p.amount);
    if (Number.isNaN(amount) || !Number.isFinite(amount)) {
      const err: any = new Error('Invalid payment amount');
      err.statusCode = 400;
      throw err;
    }
    paymentData.push({
      saleId,
      method: methodStr as PaymentMethod,
      amount,
      txnRef: p.txnRef || null,
    });
  }

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

  const updatedSale = await prisma.$transaction(async (tx) => {
    if (paymentsToCreate.length > 0) {
      await tx.payment.createMany({ data: paymentsToCreate });
    }
    return tx.sale.update({
      where: { id: saleId },
      data: { status: saleStatus },
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: customerWithAreaInclude,
      },
    });
  });

  if (!skipInventorySync) {
    const unitMapPay = await loadProductUnitTypes(sale.items.map((i) => i.productId));
    try {
      await ensureInventoryDeductedForSale(
        prisma,
        saleId,
        sale.storeId,
        sale.items,
        unitMapPay
      );
    } catch (inventoryError: any) {
      console.error('[Payment] Inventory sync failed for sale:', saleId, inventoryError);
    }
  }

  const becameSettled =
    isSettledWithActual &&
    sale.status !== 'PAID' &&
    existingSums.actual < Math.round(sale.grandTotal) - 0.5;

  if (sale.customerId && becameSettled) {
    void awardSaleLoyaltyEarn(prisma, {
      saleId,
      saleNo: sale.saleNo,
      customerId: sale.customerId,
      storeId: sale.storeId,
      grandTotal: sale.grandTotal,
      userId: actorUserId,
    }).catch((err) => console.warn('[Payment] Loyalty award failed (non-critical):', err));
  }

  void prisma.auditLog
    .create({
      data: {
        storeId: sale.storeId,
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
