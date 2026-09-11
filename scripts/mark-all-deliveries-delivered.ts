#!/usr/bin/env tsx
/**
 * Mark every open delivery as DELIVERED (one-time queue clear).
 *
 * Usage:
 *   pnpm exec tsx scripts/mark-all-deliveries-delivered.ts           # dry-run
 *   pnpm exec tsx scripts/mark-all-deliveries-delivered.ts --apply   # write
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

async function main() {
  const grouped = await prisma.deliveryOrder.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count.id]));
  const open = await prisma.deliveryOrder.findMany({
    where: { status: { not: 'DELIVERED' } },
    select: { id: true, status: true, sale: { select: { saleNo: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Current status counts:', counts);
  console.log(`Open / not delivered: ${open.length}`);
  for (const d of open.slice(0, 40)) {
    console.log(`  ${d.status} ${d.sale.saleNo}`);
  }
  if (open.length > 40) console.log(`  …and ${open.length - 40} more`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to mark them DELIVERED.');
    return;
  }

  const now = new Date();
  const result = await prisma.deliveryOrder.updateMany({
    where: { status: { not: 'DELIVERED' } },
    data: {
      status: 'DELIVERED',
      deliveredAt: now,
      failureReason: null,
    },
  });
  console.log(`\nMarked ${result.count} delivery order(s) as DELIVERED.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
