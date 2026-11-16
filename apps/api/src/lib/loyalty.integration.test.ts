/**
 * K2 Family tiers against real Postgres (mobile-first rollout).
 *
 * Run: LOYALTY_IT_DATABASE_URL=postgresql://user@localhost:5432/throwaway pnpm --filter @azela-pos/api test
 * Skipped when LOYALTY_IT_DATABASE_URL is not set. Uses its own env var (not MOBILE_IT_DATABASE_URL)
 * because the mobile suite TRUNCATEs every table. Creates its own rows; never point at prod.
 *
 * Rules under test (LOYALTY_TIERS_SCOPE=app, the default):
 *  - only bills for orders placed in the mobile app earn at the customer's tier rate
 *  - counter bills earn the base 1.25% and the stored Customer.loyaltyTier is never touched
 *  - tier comes from VISITS (paid days, counter + app); an upgrade applies from the next bill
 * and with LOYALTY_TIERS_SCOPE=all: every bill earns at the tier and the stored tier is promoted.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const DB = process.env.LOYALTY_IT_DATABASE_URL;
const run = DB ? describe : describe.skip;

run('K2 Family loyalty tiers (real Postgres)', () => {
  let prisma: any;
  let awardSaleLoyaltyEarn: any;
  let countCustomerVisits: any;
  let isAppOrderSale: any;
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

  const sale = async (customerId: string, daysAgo: number, total: number, opts: { status?: string; preOrderId?: string } = {}) =>
    prisma.sale.create({
      data: {
        storeId: ids.store, saleNo: `${tag}-${++n}`, customerId, status: opts.status ?? 'PAID', subTotal: total, grandTotal: total,
        createdByUserId: ids.cashier, createdAt: noonIst(daysAgo),
        items: { create: [{ productId: ids.product, qtyKg: 1, rate: total, lineTotal: total, ...(opts.preOrderId ? { metaJson: { preOrderId: opts.preOrderId } } : {}) }] },
        payments: { create: [{ method: 'UPI', amount: total }] },
      },
    });
  const award = (customerId: string, s: { id: string; saleNo: string; grandTotal: number }) =>
    awardSaleLoyaltyEarn(prisma, { saleId: s.id, saleNo: s.saleNo, customerId, storeId: ids.store, grandTotal: Number(s.grandTotal), awardReferral: false });
  const tierOf = async (id: string) => (await prisma.customer.findUnique({ where: { id }, select: { loyaltyTier: true } })).loyaltyTier;
  const newCustomer = (label: string, extra: Record<string, unknown> = {}) =>
    prisma.customer.create({ data: { storeId: ids.store, name: label, phone: `${tag}${++n}`, loyaltyPoints: 0, ...extra } });
  /** A mobile-app order (PreOrder + MobileOrder). Returns the pre-order id. */
  const appOrder = async (customerId: string) => {
    const k = ++n;
    const identity = await prisma.customerIdentity.create({ data: { phone: `9${String(Date.now()).slice(-8)}${k % 10}`.slice(0, 10), verifiedAt: new Date(), verificationMethod: 'OTP', primaryCustomerId: customerId } });
    const po = await prisma.preOrder.create({ data: { storeId: ids.store, customerId, customerName: 'App', customerPhone: identity.phone, trackingCode: `${tag}-${k}`, readyAt: new Date() } });
    await prisma.mobileOrder.create({
      data: { preOrderId: po.id, identityId: identity.id, customerId, storeId: ids.store, idempotencyKey: `${tag}-${k}`, requestHash: 'x', quoteJson: {}, estimatedTotalPaise: 100000, fulfillment: 'PICKUP', slotStart: new Date(), slotEnd: new Date(), paymentMethod: 'PAY_AT_PICKUP' },
    });
    return po.id as string;
  };
  const pastVisits = async (customerId: string, count: number, startDaysAgo = count + 1) => {
    for (let d = startDaysAgo; d > startDaysAgo - count; d--) await sale(customerId, d, 200);
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    ({ prisma } = await import('@azela-pos/db'));
    ({ awardSaleLoyaltyEarn, countCustomerVisits, isAppOrderSale } = await import('./loyalty.js'));
    const store = await prisma.store.create({ data: { name: `Tier test ${tag}`, type: 'OWNER' } });
    ids.store = store.id;
    ids.cashier = (await prisma.user.create({ data: { storeId: store.id, name: 'Cashier', phone: `7${Date.now()}`.slice(0, 10), role: 'CASHIER', passwordHash: 'x' } })).id;
    const cat = await prisma.category.create({ data: { ownerStoreId: store.id, name: 'Chicken', sortOrder: 1 } });
    ids.product = (await prisma.product.create({ data: { ownerStoreId: store.id, sku: `${tag}-C`, plu: `${tag}-C`, name: 'Curry Cut', categoryId: cat.id, unitType: 'KG' } })).id;
  });

  afterEach(() => {
    delete process.env.LOYALTY_TIERS_SCOPE;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('counts visits as distinct paid days, ignoring extra bills on the same day and void bills', async () => {
    const c = await newCustomer('Visits');
    await sale(c.id, 10, 500);
    await sale(c.id, 10, 300); // same day
    await sale(c.id, 9, 400);
    await sale(c.id, 8, 900, { status: 'VOID' });
    expect(await countCustomerVisits(prisma, c.id)).toBe(2);
    // excludeSaleId leaves one bill out (used to find the tier held BEFORE a bill)
    const extra = await sale(c.id, 7, 100);
    expect(await countCustomerVisits(prisma, c.id)).toBe(3);
    expect(await countCustomerVisits(prisma, c.id, undefined, extra.id)).toBe(2);
  });

  it('recognises an app-order bill by the pre-order id on its items, or by the PreOrder.saleId link', async () => {
    const c = await newCustomer('Recognise');
    const viaItem = await sale(c.id, 0, 500, { preOrderId: await appOrder(c.id) });
    const counter = await sale(c.id, 0, 500);
    const viaLink = await sale(c.id, 0, 500);
    const poLink = await appOrder(c.id);
    await prisma.preOrder.update({ where: { id: poLink }, data: { saleId: viaLink.id } });
    expect(await isAppOrderSale(prisma, viaItem.id)).toBe(true);
    expect(await isAppOrderSale(prisma, counter.id)).toBe(false);
    expect(await isAppOrderSale(prisma, viaLink.id)).toBe(true);
  });

  it('mobile-only: a counter bill earns the base 1.25% even for a 100-visit customer, and the stored tier is untouched', async () => {
    const c = await newCustomer('Counter regular', { loyaltyTier: 'SILVER' }); // the old spend tier stays as is
    await pastVisits(c.id, 100);
    const s = await sale(c.id, 0, 1000);
    expect((await award(c.id, s)).pointsEarned).toBe(12); // 1.25%, not 2.75%
    expect(await tierOf(c.id)).toBe('SILVER');
    const earn = await prisma.loyaltyTransaction.findFirst({ where: { saleId: s.id, type: 'EARN' } });
    expect(earn.description).toBe(`Earned 12 points from purchase ${s.saleNo}`); // original wording
  });

  it('mobile-only: an app-order bill earns at the visit tier; the stored tier is untouched', async () => {
    const c = await newCustomer('App family'); // stored BRONZE
    await pastVisits(c.id, 100);
    const s = await sale(c.id, 0, 1000, { preOrderId: await appOrder(c.id) });
    expect((await award(c.id, s)).pointsEarned).toBe(27); // K2 Family 2.75%
    expect(await tierOf(c.id)).toBe('BRONZE');
    const earn = await prisma.loyaltyTransaction.findFirst({ where: { saleId: s.id, type: 'EARN' } });
    expect(earn.description).toContain('(K2 Family, 2.75%)');
  });

  it('mobile-only: the higher rate starts on the bill after the 15th visit, and counter visits count', async () => {
    const c = await newCustomer('Upgrader');
    await pastVisits(c.id, 14); // counter visits
    // 15th visit, an app order: tier held before it is Member (14 visits) → 1.25%
    const s15 = await sale(c.id, 0, 1000, { preOrderId: await appOrder(c.id) });
    expect((await award(c.id, s15)).pointsEarned).toBe(12);
    // Next app order the same day: now 15 visits → Regular 1.75%
    const s16 = await sale(c.id, 0, 1000, { preOrderId: await appOrder(c.id) });
    expect((await award(c.id, s16)).pointsEarned).toBe(17);
    // Idempotent
    expect((await award(c.id, s16)).pointsEarned).toBe(0);
    expect((await prisma.customer.findUnique({ where: { id: c.id } })).loyaltyPoints).toBe(29);
  });

  it('scope=all: every bill earns at the tier and the stored tier is promoted, never downgraded', async () => {
    process.env.LOYALTY_TIERS_SCOPE = 'all';
    const c = await newCustomer('POS later');
    await pastVisits(c.id, 14);
    const s15 = await sale(c.id, 0, 1000); // counter bill, 15th visit: earned at Member, then promoted
    expect((await award(c.id, s15)).pointsEarned).toBe(12);
    expect(await tierOf(c.id)).toBe('SILVER');
    const s16 = await sale(c.id, 0, 1000);
    expect((await award(c.id, s16)).pointsEarned).toBe(17);

    const family = await newCustomer('Stored family', { loyaltyTier: 'PLATINUM' });
    const sf = await sale(family.id, 0, 1000);
    expect((await award(family.id, sf)).pointsEarned).toBe(27);
    expect(await tierOf(family.id)).toBe('PLATINUM');
  });

  it('a tiny bill that earns 0 points still counts as a visit (scope=all promotes)', async () => {
    process.env.LOYALTY_TIERS_SCOPE = 'all';
    const c = await newCustomer('Small bills');
    for (let d = 14; d >= 1; d--) await sale(c.id, d, 60);
    const s = await sale(c.id, 0, 50); // 50 × 1.25% = 0.625 → 0 points
    expect((await award(c.id, s)).pointsEarned).toBe(0);
    expect(await tierOf(c.id)).toBe('SILVER');
  });
});
