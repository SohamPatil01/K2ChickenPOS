/**
 * One-shot: credit PAID sales that never got an EARN row.
 * Safe to re-run (idempotent per sale).
 *
 * Usage: node scripts/repair-missing-loyalty-earns.mjs
 */
import { createRequire } from 'module';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../packages/db/node_modules/@prisma/client');

const LOYALTY_EARN_RATE = 0.0125;
function computeLoyaltyEarnPoints(grandTotal) {
  return Math.floor(Math.max(0, Number(grandTotal) || 0) * LOYALTY_EARN_RATE);
}

const prisma = new PrismaClient();

async function awardOne(sale) {
  return prisma.$transaction(async (tx) => {
    const already = await tx.loyaltyTransaction.findFirst({
      where: { saleId: sale.id, type: 'EARN' },
      select: { id: true },
    });
    if (already) return 0;

    const pts = computeLoyaltyEarnPoints(sale.grandTotal);
    if (pts <= 0) return 0;

    const customer = await tx.customer.findFirst({
      where: { id: sale.customerId },
      select: { loyaltyPoints: true, totalSpent: true },
    });
    if (!customer) return 0;

    const newBalance = (customer.loyaltyPoints || 0) + pts;
    const newTotalSpent = (customer.totalSpent || 0) + Number(sale.grandTotal);

    await tx.customer.update({
      where: { id: sale.customerId },
      data: { loyaltyPoints: newBalance, totalSpent: newTotalSpent },
    });

    await tx.loyaltyTransaction.create({
      data: {
        customerId: sale.customerId,
        storeId: sale.storeId,
        type: 'EARN',
        points: pts,
        balance: newBalance,
        description: `Earned ${pts} points from purchase ${sale.saleNo}`,
        saleId: sale.id,
        createdBy: null,
      },
    });
    return pts;
  });
}

async function main() {
  const missing = await prisma.$queryRaw`
    SELECT s.id, s."saleNo", s."customerId", s."storeId", s."grandTotal"
    FROM "Sale" s
    WHERE s."customerId" IS NOT NULL
      AND s.status = 'PAID'
      AND NOT EXISTS (
        SELECT 1 FROM "LoyaltyTransaction" lt
        WHERE lt."saleId" = s.id AND lt.type = 'EARN'
      )
    ORDER BY s."createdAt" ASC
  `;

  console.log(`Found ${missing.length} PAID sales missing EARN`);
  let repaired = 0;
  let pointsAdded = 0;
  let errors = 0;

  for (const sale of missing) {
    try {
      const pts = await awardOne(sale);
      if (pts > 0) {
        repaired += 1;
        pointsAdded += pts;
      }
    } catch (e) {
      errors += 1;
      console.warn('Failed', sale.saleNo, e?.message || e);
    }
  }

  console.log(JSON.stringify({ scanned: missing.length, repaired, pointsAdded, errors }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
