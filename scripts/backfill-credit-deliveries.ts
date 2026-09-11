#!/usr/bin/env tsx
/**
 * Backfill DeliveryOrder rows for credit bills that never made it into Delivery.
 *
 * Credit sales stay OPEN (not PAID), so POST /delivery used to reject them.
 * This script finds those booked-credit sales (customer attached, no delivery yet)
 * and creates DELIVERY orders.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-credit-deliveries.ts           # dry-run
 *   pnpm exec tsx scripts/backfill-credit-deliveries.ts --apply   # write
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

function impliedFee(sale: {
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
}): number {
  const itemsTotal = Math.round(
    Math.round(sale.subTotal * 100) / 100 +
      Math.round(sale.taxTotal * 100) / 100 -
      Math.round(sale.discountTotal * 100) / 100
  );
  return Math.max(0, Math.round(sale.grandTotal) - itemsTotal);
}

async function main() {
  const sales = await prisma.sale.findMany({
    where: {
      status: 'OPEN',
      customerId: { not: null },
      deliveryOrder: { is: null },
      payments: { some: { method: 'CREDIT' } },
    },
    select: {
      id: true,
      saleNo: true,
      storeId: true,
      status: true,
      customerId: true,
      createdByUserId: true,
      createdAt: true,
      subTotal: true,
      taxTotal: true,
      discountTotal: true,
      grandTotal: true,
      customer: {
        select: {
          name: true,
          phone: true,
          addresses: {
            select: { id: true, line1: true, city: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${sales.length} credit bill(s) with a customer and no delivery.`);
  if (sales.length === 0) {
    return;
  }

  for (const s of sales) {
    const fee = impliedFee(s);
    const addr = s.customer?.addresses?.[0];
    console.log(
      `${s.createdAt.toISOString().slice(0, 10)} ${s.saleNo} ${s.status} ₹${Math.round(s.grandTotal)} fee=${fee} ${s.customer?.name || ''} ${s.customer?.phone || ''} addr=${addr ? addr.city : '-'}`
    );
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create delivery rows.');
    return;
  }

  let created = 0;
  for (const s of sales) {
    const fee = impliedFee(s);
    const addressId = s.customer?.addresses?.[0]?.id || null;
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const otpCodeHash = crypto.createHash('sha256').update(otp).digest('hex');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.deliveryOrder.findUnique({ where: { saleId: s.id } });
      if (existing) return;
      const delivery = await tx.deliveryOrder.create({
        data: {
          storeId: s.storeId,
          saleId: s.id,
          type: 'DELIVERY',
          status: 'CREATED',
          deliveryFee: fee,
          addressId,
          otpCodeHash,
        },
      });
      await tx.deliveryEvent.create({
        data: {
          deliveryOrderId: delivery.id,
          status: 'CREATED',
          createdBy: s.createdByUserId,
          note: 'Backfilled from booked credit bill',
        },
      });
    });
    created += 1;
  }

  console.log(`\nCreated ${created} delivery order(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
