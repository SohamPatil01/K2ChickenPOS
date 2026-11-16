/**
 * K2 Family tiers against real Postgres: visit counting, tier-rate earning, promotion, no downgrade.
 *
 * Run: LOYALTY_IT_DATABASE_URL=postgresql://user@localhost:5432/throwaway pnpm --filter @azela-pos/api test
 * Skipped when LOYALTY_IT_DATABASE_URL is not set. Uses its own env var (not MOBILE_IT_DATABASE_URL)
 * because the mobile suite TRUNCATEs every table. Creates its own rows; never point at prod.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DB = process.env.LOYALTY_IT_DATABASE_URL;
const run = DB ? describe : describe.skip;

run('K2 Family loyalty tiers (real Postgres)', () => {
  let prisma: any;
  let awardSaleLoyaltyEarn: any;
  let countCustomerVisits: any;
  const ids: Record<string, string> = {};
  let n = 0;
  const tag = `lt${Date.now().toString(36)}`;

  /** Noon IST, `daysAgo` days back — far from the IST midnight boundary. */
  const noonIst = (daysAgo: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(6, 30, 0, 0);
    return d;
  };

  const sale = async (customerId: string, daysAgo: number, total: number, status = 'PAID') => {
    const s = await prisma.sale.create({
      data: {
        storeId: ids.store, saleNo: `${tag}-${++n}`, customerId, status, subTotal: total, grandTotal: total,
        createdByUserId: ids.cashier, createdAt: noonIst(daysAgo),
        items: { create: [{ productId: ids.product, qtyKg: 1, rate: total, lineTotal: total }] },
        payments: { create: [{ method: 'UPI', amount: total }] },
      },
    });
    return s;
  };
  const award = (customerId: string, s: { id: string; saleNo: string; grandTotal: number }) =>
    awardSaleLoyaltyEarn(prisma, { saleId: s.id, saleNo: s.saleNo, customerId, storeId: ids.store, grandTotal: Number(s.grandTotal), awardReferral: false });
  const tierOf = async (id: string) => (await prisma.customer.findUnique({ where: { id }, select: { loyaltyTier: true } })).loyaltyTier;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    ({ prisma } = await import('@azela-pos/db'));
    ({ awardSaleLoyaltyEarn, countCustomerVisits } = await import('./loyalty.js'));
    const store = await prisma.store.create({ data: { name: `Tier test ${tag}`, type: 'OWNER' } });
    ids.store = store.id;
    ids.cashier = (await prisma.user.create({ data: { storeId: store.id, name: 'Cashier', phone: `7${Date.now()}`.slice(0, 10), role: 'CASHIER', passwordHash: 'x' } })).id;
    const cat = await prisma.category.create({ data: { ownerStoreId: store.id, name: 'Chicken', sortOrder: 1 } });
    ids.product = (await prisma.product.create({ data: { ownerStoreId: store.id, sku: `${tag}-C`, plu: `${tag}-C`, name: 'Curry Cut', categoryId: cat.id, unitType: 'KG' } })).id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('counts visits as distinct paid days, ignoring extra bills on the same day and void bills', async () => {
    const c = await prisma.customer.create({ data: { storeId: ids.store, name: 'Visits', phone: `${tag}1`, loyaltyPoints: 0 } });
    await sale(c.id, 10, 500);
    await sale(c.id, 10, 300); // same day
    await sale(c.id, 9, 400);
    await sale(c.id, 8, 900, 'VOID');
    expect(await countCustomerVisits(prisma, c.id)).toBe(2);
  });

  it('earns at the tier held when the bill is paid, then promotes on the 15th visit', async () => {
    const c = await prisma.customer.create({ data: { storeId: ids.store, name: 'Regular-to-be', phone: `${tag}2`, loyaltyPoints: 0 } });
    for (let d = 14; d >= 1; d--) await sale(c.id, d, 200); // 14 past visits, no EARN rows needed
    expect(await tierOf(c.id)).toBe('BRONZE');

    // 15th visit: earned at Member 1.25% (1000 → 12), customer becomes Regular afterwards.
    const s15 = await sale(c.id, 0, 1000);
    expect((await award(c.id, s15)).pointsEarned).toBe(12);
    expect(await tierOf(c.id)).toBe('SILVER');
    const earn = await prisma.loyaltyTransaction.findFirst({ where: { saleId: s15.id, type: 'EARN' } });
    expect(earn.description).toContain('(Member, 1.25%)');

    // Next bill (same day, still 15 visits): Regular 1.75% → 17.
    const s16 = await sale(c.id, 0, 1000);
    expect((await award(c.id, s16)).pointsEarned).toBe(17);
    expect(await countCustomerVisits(prisma, c.id)).toBe(15);

    // Idempotent: awarding the same sale again earns nothing.
    expect((await award(c.id, s16)).pointsEarned).toBe(0);
    expect((await prisma.customer.findUnique({ where: { id: c.id } })).loyaltyPoints).toBe(29);
  });

  it('never downgrades a tier', async () => {
    const c = await prisma.customer.create({ data: { storeId: ids.store, name: 'Family', phone: `${tag}3`, loyaltyPoints: 0, loyaltyTier: 'PLATINUM' } });
    const s = await sale(c.id, 0, 1000);
    expect((await award(c.id, s)).pointsEarned).toBe(27); // K2 Family 2.75%
    expect(await tierOf(c.id)).toBe('PLATINUM');
  });

  it('a tiny bill that earns 0 points still counts as a visit and can promote', async () => {
    const c = await prisma.customer.create({ data: { storeId: ids.store, name: 'Small bills', phone: `${tag}4`, loyaltyPoints: 0 } });
    for (let d = 14; d >= 1; d--) await sale(c.id, d, 60);
    const s = await sale(c.id, 0, 50); // 50 × 1.25% = 0.625 → 0 points
    expect((await award(c.id, s)).pointsEarned).toBe(0);
    expect(await tierOf(c.id)).toBe('SILVER');
  });
});
