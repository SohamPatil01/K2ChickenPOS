// @ts-nocheck
import { prisma, PaymentMethod } from '@azela-pos/db';
import {
  createSaleSchema,
  paymentSchema,
  normalizePaymentsForSale,
} from '@azela-pos/shared';
import { z } from 'zod';
import {
  quantitiesForInventoryDeduction,
  ensureInventoryDeductedForSale,
} from '../utils/saleItemLedger.js';
import { upsertCustomerArea } from '../utils/customerArea.js';
import { resolveSaleItemsForCreate } from '../utils/resolveSaleItemProduct.js';

const offlinePayloadSchema = z.object({
  idempotencyKey: z.string().min(8),
  createSale: createSaleSchema,
  payments: z.array(paymentSchema).min(1),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).optional(),
});

/**
 * Apply a queued offline checkout from POST /sync/events (idempotent per store + key).
 */
export async function applyOfflineCheckoutFromSync(
  payload: Record<string, unknown>,
  storeId: string,
  userId: string
): Promise<void> {
  const data = offlinePayloadSchema.parse(payload);

  // Idempotency without Sale.offlineIdempotencyKey (supports DBs that never added that column).
  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      storeId,
      action: 'SALE_CREATED_OFFLINE_SYNC',
      metaJson: {
        path: ['offlineIdempotencyKey'],
        equals: data.idempotencyKey,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const existing =
    existingAudit?.entityId != null
      ? await prisma.sale.findUnique({
          where: { id: existingAudit.entityId },
          include: { payments: true },
        })
      : null;

  if (existing) {
    const paid = Math.round(
      existing.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
    );
    const gt = Math.round(existing.grandTotal);
    if (paid >= gt - 1) {
      return;
    }
    throw new Error(
      `OFFLINE_REPLAY_INCOMPLETE: sale ${existing.saleNo} exists but payments (${paid}) < total (${gt})`
    );
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, type: true, parentOwnerStoreId: true },
  });
  if (!store) {
    throw new Error('Store not found');
  }

  const cs = data.createSale;

  const ownerStoreId =
    store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
  if (!ownerStoreId) {
    throw new Error('Owner store is not configured for this location');
  }

  const saleItems = await resolveSaleItemsForCreate(
    prisma,
    cs.items,
    ownerStoreId
  );

  let config = null;
  if (store.type === 'FRANCHISE') {
    config = await prisma.franchiseConfig.findUnique({
      where: { franchiseStoreId: storeId },
    });
  }
  let customerId = cs.customerId;
  if (!customerId && cs.customerPhone) {
    const customer = await prisma.customer.upsert({
      where: {
        storeId_phone: {
          storeId,
          phone: cs.customerPhone,
        },
      },
      update: {
        name: cs.customerName || undefined,
        ...(cs.customerArea !== undefined
          ? { area: cs.customerArea?.trim() || null }
          : {}),
      },
      create: {
        storeId,
        phone: cs.customerPhone,
        name: cs.customerName || 'Customer',
        ...(cs.customerArea !== undefined
          ? { area: cs.customerArea?.trim() || null }
          : {}),
      },
    });
    customerId = customer.id;
    if (cs.customerArea !== undefined) {
      await upsertCustomerArea(prisma, customer.id, cs.customerArea);
    }
  } else if (customerId && cs.customerArea !== undefined) {
    await upsertCustomerArea(prisma, customerId, cs.customerArea);
  }

  let subTotal = 0;
  let taxTotal = 0;
  for (const item of saleItems) {
    const lineTotal = (item.qtyKg || item.qtyPcs || 0) * item.rate;
    subTotal += lineTotal;
    taxTotal += lineTotal * (item.taxRate / 100);
  }
  subTotal = Math.round(subTotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;

  if (config?.isDiscountLocked && cs.discountTotal > 0) {
    throw new Error('Discount overrides are locked by HQ; offline sale rejected');
  }

  const allowedDiscountPercent = config?.allowedDiscountPercent || 10.0;
  const maxAllowedDiscount = (subTotal * allowedDiscountPercent) / 100;
  if (cs.discountTotal > maxAllowedDiscount) {
    throw new Error(
      'OFFLINE_DISCOUNT_REQUIRES_APPROVAL: discount exceeds franchise limit; retry after approval flow'
    );
  }

  const deliveryFee = Math.max(0, cs.deliveryFee ?? 0);
  const grandTotal =
    Math.round((subTotal + taxTotal - cs.discountTotal + deliveryFee) * 100) / 100;
  const roundedGrandTotal = Math.round(grandTotal);

  const todayForNo = new Date();
  const dateStr = todayForNo.toISOString().split('T')[0].replace(/-/g, '');
  let saleNo: string;
  let attempts = 0;
  const maxAttempts = 5;
  do {
    const dayStart = new Date(todayForNo);
    dayStart.setHours(0, 0, 0, 0);
    const count = await prisma.sale.count({
      where: {
        storeId,
        createdAt: { gte: dayStart },
      },
    });
    saleNo = `SALE-${dateStr}-${String(count + 1 + attempts).padStart(4, '0')}`;
    attempts++;
    const dup = await prisma.sale.findUnique({
      where: { storeId_saleNo: { storeId, saleNo } },
    });
    if (!dup) break;
    if (attempts >= maxAttempts) {
      saleNo = `SALE-${dateStr}-${Date.now().toString().slice(-8)}`;
      break;
    }
  } while (attempts < maxAttempts);

  const normalizedPayments = normalizePaymentsForSale(data.payments, roundedGrandTotal);

  const validPaymentMethods: PaymentMethod[] = [
    'CASH',
    'CARD',
    'UPI',
    'CREDIT',
    'ONLINE',
  ];
  for (const p of normalizedPayments) {
    const methodStr = String(p.method || '')
      .toUpperCase()
      .trim();
    if (!validPaymentMethods.includes(methodStr as PaymentMethod)) {
      throw new Error(`Invalid payment method: ${p.method}`);
    }
  }

  const hasNewCredit = normalizedPayments.some((p) => p.method === 'CREDIT');
  const newPaymentsTotal = normalizedPayments.reduce((s, p) => s + p.amount, 0);
  const roundedPaidAfter = Math.round(newPaymentsTotal);
  let saleStatus: 'OPEN' | 'PAID' = 'PAID';
  if (roundedPaidAfter >= roundedGrandTotal - 1) {
    if (hasNewCredit) {
      saleStatus = 'OPEN';
    } else {
      saleStatus = 'PAID';
    }
  } else {
    saleStatus = 'OPEN';
  }

  const offlineProductIds = [...new Set(saleItems.map((i) => i.productId))];
  const offlineProductRows = await prisma.product.findMany({
    where: { id: { in: offlineProductIds } },
    select: { id: true, unitType: true },
  });
  const offlineUnitMap = new Map(
    offlineProductRows.map((p) => [p.id, p.unitType])
  );

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        storeId,
        saleNo,
        customerId: customerId ?? null,
        status: saleStatus,
        subTotal,
        discountTotal: cs.discountTotal,
        taxTotal,
        grandTotal: roundedGrandTotal,
        createdByUserId: userId,
        items: {
          create: saleItems.map((item: any) => {
            const qty = item.qtyKg || item.qtyPcs || 0;
            const lineTotal = Math.round(qty * item.rate * 100) / 100;
            const taxAmount =
              Math.round(lineTotal * (item.taxRate / 100) * 100) / 100;
            return {
              productId: item.productId,
              qtyKg: item.qtyKg,
              qtyPcs: item.qtyPcs,
              rate: item.rate,
              lineTotal,
              taxRate: item.taxRate,
              taxAmount,
              metaJson: item.metaJson,
            };
          }),
        },
      },
      include: { items: true },
    });

    await ensureInventoryDeductedForSale(
      tx,
      created.id,
      storeId,
      created.items,
      offlineUnitMap
    );

    const paymentRows = normalizedPayments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        saleId: created.id,
        method: String(p.method).toUpperCase().trim() as PaymentMethod,
        amount: p.amount,
        txnRef: p.txnRef || null,
      }));

    if (paymentRows.length > 0) {
      await tx.payment.createMany({ data: paymentRows });
    }

    await tx.auditLog.create({
      data: {
        storeId,
        actorUserId: userId,
        action: 'SALE_CREATED_OFFLINE_SYNC',
        entityType: 'Sale',
        entityId: created.id,
        metaJson: {
          saleNo,
          offlineIdempotencyKey: data.idempotencyKey,
          grandTotal: roundedGrandTotal,
        },
      },
    });

    return created;
  });

  if (data.fulfillmentType === 'DELIVERY' && sale.customerId) {
    try {
      const existingDel = await prisma.deliveryOrder.findUnique({
        where: { saleId: sale.id },
      });
      if (!existingDel) {
        await prisma.deliveryOrder.create({
          data: {
            storeId,
            saleId: sale.id,
            type: 'DELIVERY',
            deliveryFee,
          },
        });
      }
    } catch (e) {
      console.warn('[offlineCheckoutSync] delivery create skipped:', e);
    }
  }
}
