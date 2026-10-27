// @ts-nocheck
import crypto from 'crypto';
import { prisma } from '@azela-pos/db';
import { CUSTOMER_AREA_LABEL } from '../utils/customerArea.js';

/** Prefer Home/Delivery label, else first real address (never the Area mirror row). */
export async function findPreferredCustomerAddressId(
  customerId: string
): Promise<string | null> {
  const addresses = await prisma.customerAddress.findMany({
    where: {
      customerId,
      label: { not: CUSTOMER_AREA_LABEL },
      NOT: { line1: '—' },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, label: true },
  });
  if (!addresses.length) return null;
  const preferred = addresses.find((a) => {
    const label = String(a.label || '').toLowerCase();
    return label === 'home' || label === 'delivery' || label.includes('home');
  });
  return (preferred || addresses[0]).id;
}

/**
 * Create a delivery row for a settled sale when fulfillment is DELIVERY.
 * Idempotent: returns existing deliveryOrder id when already present.
 * Auto-attaches the customer's saved address when one exists.
 */
export async function ensureDeliveryForSale(input: {
  saleId: string;
  deliveryFee?: number;
  actorUserId: string;
  type?: 'DELIVERY' | 'PICKUP';
}): Promise<{ id: string; created: boolean } | null> {
  const type = input.type || 'DELIVERY';
  if (type !== 'DELIVERY') return null;

  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    include: {
      deliveryOrder: { select: { id: true, addressId: true } },
      payments: { select: { method: true } },
    },
  });
  if (!sale) return null;
  if (sale.deliveryOrder) {
    // Backfill address on existing delivery if still missing.
    if (!sale.deliveryOrder.addressId && sale.customerId) {
      const addressId = await findPreferredCustomerAddressId(sale.customerId);
      if (addressId) {
        await prisma.deliveryOrder.update({
          where: { id: sale.deliveryOrder.id },
          data: { addressId },
        });
      }
    }
    return { id: sale.deliveryOrder.id, created: false };
  }

  const isPaid = sale.status === 'PAID';
  const isBookedCredit =
    sale.status === 'OPEN' &&
    (sale.payments || []).some((p) => String(p.method).toUpperCase() === 'CREDIT');
  if (!isPaid && !isBookedCredit) return null;
  if (!sale.customerId) return null;

  const impliedFee = Math.max(
    0,
    Math.round(sale.grandTotal) -
      Math.round(sale.subTotal + sale.taxTotal - sale.discountTotal)
  );
  const resolvedFee =
    Number(input.deliveryFee) > 0 ? Number(input.deliveryFee) : impliedFee;

  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const otpCodeHash = crypto.createHash('sha256').update(otp).digest('hex');
  const addressId = await findPreferredCustomerAddressId(sale.customerId);

  try {
    const delivery = await prisma.deliveryOrder.create({
      data: {
        storeId: sale.storeId,
        saleId: sale.id,
        type: 'DELIVERY',
        status: 'CREATED',
        deliveryFee: resolvedFee,
        addressId,
        otpCodeHash,
      },
    });
    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: delivery.id,
        status: 'CREATED',
        createdBy: input.actorUserId,
      },
    });
    return { id: delivery.id, created: true };
  } catch (err: any) {
    // Race: another request created the row
    if (err?.code === 'P2002') {
      const existing = await prisma.deliveryOrder.findUnique({
        where: { saleId: sale.id },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }
    throw err;
  }
}
