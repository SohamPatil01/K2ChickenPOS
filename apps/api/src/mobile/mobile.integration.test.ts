/**
 * End-to-end API tests against a REAL PostgreSQL database (no mocks for persistence).
 * Run: MOBILE_IT_DATABASE_URL=postgresql://... pnpm --filter @azela-pos/api test
 * Skipped when MOBILE_IT_DATABASE_URL is not set. The database is wiped — never point at prod.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

const DB = process.env.MOBILE_IT_DATABASE_URL;
const run = DB ? describe : describe.skip;

if (DB) {
  if (/rlwy|railway|supabase|amazonaws|neon/i.test(DB)) throw new Error('Refusing to run integration tests against a hosted database');
  process.env.DATABASE_URL = DB.includes('connection_limit') ? DB : `${DB}${DB.includes('?') ? '&' : '?'}connection_limit=8`;
  process.env.JWT_SECRET = 'integration-test-secret-integration-test-secret';
  process.env.MOBILE_OTP_PROVIDER = 'dev-console';
  process.env.MOBILE_OTP_DEV_ECHO = 'true';
  process.env.MOBILE_CRON_SECRET = 'cron-secret-for-tests';
  process.env.MOBILE_REORDER_HOLDOUT_PERCENT = '0';
}

type Json = Record<string, any>;
const sent: Array<{ token: string; title: string; data: Record<string, string> }> = [];
const deadTokens = new Set<string>();

run('mobile API (real Postgres)', () => {
  let app: FastifyInstance;
  let prisma: any;
  let runMobileTick: (now?: Date) => Promise<any>;
  let awardSaleLoyaltyEarn: any;
  let staffToken = '';
  let ownerToken = '';
  const ids: Record<string, string> = {};

  const inject = async (method: string, url: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const res = await app.inject({
      method: method as any,
      url,
      payload: opts.body as any,
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.headers ?? {}) },
    });
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as Json) : {} };
  };

  async function login(phone: string, client: string, extra: Json = {}) {
    const r = await inject('POST', '/api/v1/mobile/auth/otp/request', { body: { phone }, headers: { 'x-test-client': client } });
    expect(r.status).toBe(200);
    const v = await inject('POST', '/api/v1/mobile/auth/otp/verify', {
      body: { phone, challengeId: r.body.challengeId, code: r.body.devCode, platform: 'android', ...extra },
      headers: { 'x-test-client': client },
    });
    expect(v.status).toBe(200);
    return v.body as { accessToken: string; refreshToken: string; isNewCustomer: boolean };
  }

  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
  /** Next 12:00 IST at or after now — outside quiet hours, so results don't depend on when CI runs. */
  const nextIstNoon = () => {
    const d = new Date();
    d.setUTCHours(6, 30, 0, 0);
    if (d.getTime() < Date.now()) d.setTime(d.getTime() + 86_400_000);
    return d;
  };

  beforeAll(async () => {
    const db = await import('@azela-pos/db');
    prisma = db.prisma;
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(`TRUNCATE ${(tables as any[]).map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);

    const Fastify = (await import('fastify')).default;
    const jwt = (await import('@fastify/jwt')).default;
    const rateLimit = (await import('@fastify/rate-limit')).default;
    const { authenticate } = await import('../utils/auth.js');
    const { preOrderRoutes } = await import('../routes/preOrders.js');
    const { mobileRoutes } = await import('./index.js');
    const push = await import('./providers/push.js');
    ({ runMobileTick } = await import('./workers/tick.js'));
    ({ awardSaleLoyaltyEarn } = await import('../lib/loyalty.js'));

    push.setPushProviderForTests({
      name: 'test',
      async send(msgs) {
        return msgs.map((m) => {
          if (deadTokens.has(m.token)) return { token: m.token, status: 'error' as const, error: 'DeviceNotRegistered', invalidToken: true };
          sent.push({ token: m.token, title: m.title, data: m.data });
          return { token: m.token, status: 'ok' as const, ticketId: `t-${sent.length}` };
        });
      },
    });

    app = Fastify({ logger: false });
    await app.register(rateLimit as any, { max: 10_000, timeWindow: '1 minute', keyGenerator: (req: any) => String(req.headers['x-test-client'] || req.ip) });
    await app.register(jwt, { secret: process.env.JWT_SECRET! });
    app.decorate('authenticate', authenticate);
    await app.register(preOrderRoutes, { prefix: '/api/v1/pre-orders' });
    await app.register(mobileRoutes, { prefix: '/api/v1/mobile' });
    await app.ready();

    // ---- POS seed (shape mirrors real POS data) ----
    const store = await prisma.store.create({ data: { name: 'K2 Chicken Pimple Nilakh', type: 'OWNER' } });
    ids.store = store.id;
    const cashier = await prisma.user.create({ data: { storeId: store.id, name: 'Cashier', phone: '7000000001', role: 'CASHIER', passwordHash: 'x' } });
    const owner = await prisma.user.create({ data: { storeId: store.id, name: 'Owner', phone: '7000000002', role: 'OWNER', passwordHash: 'x' } });
    ids.cashier = cashier.id;
    staffToken = app.jwt.sign({ userId: cashier.id, storeId: store.id, role: 'CASHIER' });
    ownerToken = app.jwt.sign({ userId: owner.id, storeId: store.id, role: 'OWNER' });
    const cat = await prisma.category.create({ data: { ownerStoreId: store.id, name: 'Fresh Chicken', sortOrder: 1 } });
    const mk = async (sku: string, name: string, unitType: string, price: number, stock: { kg?: number; pcs?: number }) => {
      const p = await prisma.product.create({ data: { ownerStoreId: store.id, sku, plu: sku, name, categoryId: cat.id, unitType, imageUrl: 'https://cdn.example.com/x.jpg' } });
      await prisma.storeProductPrice.create({ data: { storeId: store.id, productId: p.id, pricePerUnit: price, effectiveFrom: at(30) } });
      if (stock.kg || stock.pcs) {
        await prisma.inventoryLedger.create({ data: { storeId: store.id, productId: p.id, type: 'IN', qtyKg: stock.kg ?? null, qtyPcs: stock.pcs ?? null, reason: 'RECEIVE' } });
      }
      return p;
    };
    ids.curry = (await mk('CURRY', 'Chicken Curry Cut', 'KG', 280, { kg: 50 })).id;
    ids.boneless = (await mk('BONELESS', 'Boneless Breast', 'KG', 420, {})).id;
    ids.eggs = (await mk('EGGS', 'Farm Eggs', 'PCS', 8, { pcs: 100 })).id;

    // Walk-in customer A already known to the POS (phone stored with 91 prefix) with points and 3 weekly visits.
    const a = await prisma.customer.create({ data: { storeId: store.id, name: 'Asha Patil', phone: '919876543210', loyaltyPoints: 200 } });
    ids.customerA = a.id;
    // Customer B: regular weekly buyer, used for reorder-reminder rules.
    const b = await prisma.customer.create({ data: { storeId: store.id, name: 'Bhavesh', phone: '9811111111', loyaltyPoints: 0 } });
    ids.customerB = b.id;
    let n = 0;
    const sale = async (customerId: string, daysAgo: number, kg: number) => {
      const s = await prisma.sale.create({
        data: {
          storeId: store.id, saleNo: `S-${++n}`, customerId, status: 'PAID', subTotal: 280 * kg, grandTotal: Math.round(280 * kg),
          createdByUserId: cashier.id, createdAt: at(daysAgo),
          items: { create: [{ productId: ids.curry, qtyKg: kg, rate: 280, lineTotal: 280 * kg }] },
          payments: { create: [{ method: 'UPI', amount: Math.round(280 * kg) }] },
        },
      });
      return s.id;
    };
    ids.walkinSale = await sale(a.id, 21, 1.13);
    await sale(a.id, 14, 1);
    await sale(a.id, 7, 1);
    for (const d of [27, 20, 13, 6]) await sale(b.id, d, 1);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('serves bootstrap config, stores and the live POS catalog', async () => {
    const cfg = await inject('GET', '/api/v1/mobile/config');
    expect(cfg.body.auth.otpAvailable).toBe(true);
    expect(cfg.body.onlinePaymentAvailable).toBe(false);
    const stores = await inject('GET', '/api/v1/mobile/stores');
    expect(stores.body.stores.map((s: Json) => s.id)).toEqual([ids.store]);
    const cat = await inject('GET', `/api/v1/mobile/stores/${ids.store}/catalog`);
    expect(cat.status).toBe(200);
    const curry = cat.body.products.find((p: Json) => p.id === ids.curry);
    expect(curry).toMatchObject({ pricePaise: 28000, unitLabel: 'per kg', inStock: true, availableGrams: 50000 });
    expect(cat.body.products.find((p: Json) => p.id === ids.boneless).inStock).toBe(false);
    const detail = await inject('GET', `/api/v1/mobile/stores/${ids.store}/products/${ids.curry}`);
    expect(detail.body.product.name).toBe('Chicken Curry Cut');
  });

  it('rejects invalid phones and enforces OTP attempts and cooldown', async () => {
    expect((await inject('POST', '/api/v1/mobile/auth/otp/request', { body: { phone: '12345' } })).body.code).toBe('VALIDATION_FAILED');
    expect((await inject('POST', '/api/v1/mobile/auth/otp/request', { body: { phone: '1234567890' } })).body.code).toBe('INVALID_PHONE');
    const r = await inject('POST', '/api/v1/mobile/auth/otp/request', { body: { phone: '9876543210' }, headers: { 'x-test-client': 'otp' } });
    const again = await inject('POST', '/api/v1/mobile/auth/otp/request', { body: { phone: '9876543210' }, headers: { 'x-test-client': 'otp' } });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('OTP_COOLDOWN');
    const wrong = r.body.devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const bad = await inject('POST', '/api/v1/mobile/auth/otp/verify', { body: { phone: '9876543210', challengeId: r.body.challengeId, code: wrong } });
      expect(bad.status).toBe(400);
    }
    const locked = await inject('POST', '/api/v1/mobile/auth/otp/verify', { body: { phone: '9876543210', challengeId: r.body.challengeId, code: r.body.devCode } });
    expect(locked.body.code).toBe('OTP_LOCKED');
    // Allow the next login in this suite to bypass the 30 s cooldown.
    await prisma.otpChallenge.updateMany({ where: { phone: '9876543210' }, data: { createdAt: at(1) } });
  });

  let tokenA = '';
  let refreshA = '';
  it('links a verified phone to existing POS walk-in purchases and points', async () => {
    const t = await login('+91 98765 43210', 'A');
    expect(t.isNewCustomer).toBe(false);
    tokenA = t.accessToken;
    refreshA = t.refreshToken;
    const me = await inject('GET', '/api/v1/mobile/me', { token: tokenA });
    expect(me.body).toMatchObject({ phone: '+919876543210', name: 'Asha Patil' });
    const orders = await inject('GET', '/api/v1/mobile/me/orders', { token: tokenA });
    expect(orders.body.orders).toHaveLength(3);
    expect(orders.body.orders.every((o: Json) => o.channel === 'STORE' && o.status === 'COMPLETED')).toBe(true);
    const wallet = await inject('GET', '/api/v1/mobile/me/loyalty', { token: tokenA });
    expect(wallet.body).toMatchObject({ balance: 200, availablePoints: 200, heldPoints: 0 });
  });

  it('keeps customer, portal and staff tokens strictly separated', async () => {
    expect((await inject('GET', '/api/v1/mobile/me', { token: staffToken })).status).toBe(401);
    expect((await inject('GET', '/api/v1/pre-orders', { token: tokenA })).status).toBe(401);
    const portal = app.jwt.sign({ tokenType: 'CUSTOMER', customerId: ids.customerA, storeId: ids.store, phone: '9876543210' });
    expect((await inject('GET', '/api/v1/mobile/me', { token: portal })).status).toBe(401);
    expect((await inject('GET', '/api/v1/mobile/me')).status).toBe(401);
  });

  let orderId = '';
  let quoteTotal = 0;
  const orderBody = (slotStart: string, extra: Json = {}) => ({
    storeId: ids.store,
    fulfillment: 'PICKUP',
    lines: [{ productId: ids.curry, grams: 1000, cutOptionId: 'small', notes: 'less fat' }],
    redeemPoints: 14,
    slotStart,
    paymentMethod: 'PAY_AT_PICKUP',
    confirmedTotalPaise: quoteTotal,
    ...extra,
  });
  let slotStart = '';

  it('quotes with POS prices and caps loyalty redemption', async () => {
    const q = await inject('POST', '/api/v1/mobile/checkout/quotes', {
      token: tokenA,
      body: { storeId: ids.store, lines: [{ productId: ids.curry, grams: 1000, cutOptionId: 'small' }, { productId: ids.boneless, grams: 500 }], redeemPoints: 100 },
    });
    expect(q.status).toBe(200);
    expect(q.body.quote.lines[1].status).toBe('OUT_OF_STOCK');
    expect(q.body.quote.canCheckout).toBe(false);
    const ok = await inject('POST', '/api/v1/mobile/checkout/quotes', {
      token: tokenA,
      body: { storeId: ids.store, lines: [{ productId: ids.curry, grams: 1000, cutOptionId: 'small' }], redeemPoints: 100 },
    });
    expect(ok.body.quote).toMatchObject({ merchandisePaise: 28000, totalPaise: 26600, canCheckout: true });
    expect(ok.body.quote.loyalty).toMatchObject({ maxRedeemablePoints: 14, appliedPoints: 14 });
    expect(ok.body.slots.length).toBeGreaterThan(0);
    quoteTotal = ok.body.quote.totalPaise;
    slotStart = ok.body.slots[0].start;
    const guest = await inject('POST', '/api/v1/mobile/checkout/quotes', { body: { storeId: ids.store, lines: [{ productId: ids.curry, grams: 500 }], redeemPoints: 50 } });
    expect(guest.body.quote.loyalty.appliedPoints).toBe(0);
  });

  it('places an idempotent order that lands in the existing POS pre-order queue', async () => {
    const key = 'order-key-aaaaaaaaaaaa-1';
    const stale = await inject('POST', '/api/v1/mobile/orders', { token: tokenA, body: orderBody(slotStart, { confirmedTotalPaise: 1 }), headers: { 'idempotency-key': key } });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('QUOTE_CHANGED');
    const noKey = await inject('POST', '/api/v1/mobile/orders', { token: tokenA, body: orderBody(slotStart) });
    expect(noKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const first = await inject('POST', '/api/v1/mobile/orders', { token: tokenA, body: orderBody(slotStart), headers: { 'idempotency-key': key } });
    expect(first.status).toBe(201);
    orderId = first.body.order.id;
    expect(first.body.order).toMatchObject({ status: 'PLACED', channel: 'APP', canCancel: true, loyaltyHold: { points: 14, status: 'HELD' } });
    const replay = await inject('POST', '/api/v1/mobile/orders', { token: tokenA, body: orderBody(slotStart), headers: { 'idempotency-key': key } });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ replayed: true, order: { id: orderId } });
    const reused = await inject('POST', '/api/v1/mobile/orders', {
      token: tokenA,
      body: orderBody(slotStart, { notes: 'different' }),
      headers: { 'idempotency-key': key },
    });
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await prisma.preOrder.count()).toBe(1);

    // Staff see it in the EXISTING pre-orders endpoint, with structured cut notes.
    const staff = await inject('GET', `/api/v1/pre-orders?date=${slotStart.slice(0, 10)}`, { token: staffToken });
    const po = staff.body.items.find((p: Json) => `po_${p.id}` === orderId) ?? (await inject('GET', `/api/v1/pre-orders/${orderId.slice(3)}`, { token: staffToken })).body.preOrder;
    expect(po.source).toBe('MOBILE_APP');
    expect(po.customerId).toBe(ids.customerA);
    expect(po.items[0]).toMatchObject({ productId: ids.curry, qtyKg: 1, notes: 'Cut: Small pieces · Note: less fat' });
    expect(po.notes).toContain('Redeem 14 pts');
    expect((await inject('GET', '/api/v1/mobile/me/loyalty', { token: tokenA })).body).toMatchObject({ availablePoints: 186, heldPoints: 14 });
  });

  it('never over-commits points under concurrent checkouts', async () => {
    const big = { storeId: ids.store, lines: [{ productId: ids.curry, grams: 10000 }], redeemPoints: 140 };
    const q = await inject('POST', '/api/v1/mobile/checkout/quotes', { token: tokenA, body: big });
    expect(q.body.quote.loyalty.appliedPoints).toBe(140);
    const body = { ...big, slotStart, paymentMethod: 'PAY_AT_PICKUP', confirmedTotalPaise: q.body.quote.totalPaise };
    const results = await Promise.all(
      ['concurrent-key-aaaaaaaa-1', 'concurrent-key-aaaaaaaa-2'].map((k) =>
        inject('POST', '/api/v1/mobile/orders', { token: tokenA, body, headers: { 'idempotency-key': k } })
      )
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const w = (await inject('GET', '/api/v1/mobile/me/loyalty', { token: tokenA })).body;
    expect(w.heldPoints).toBe(154);
    expect(w.availablePoints).toBeGreaterThanOrEqual(0);
    // Customer cancels that pending order → hold released.
    const placed = results.find((r) => r.status === 201)!;
    const c = await inject('POST', `/api/v1/mobile/me/orders/${placed.body.order.id}/cancel`, { token: tokenA });
    expect(c.body.order).toMatchObject({ status: 'CANCELLED', loyaltyHold: { status: 'RELEASED' } });
    expect((await inject('GET', '/api/v1/mobile/me/loyalty', { token: tokenA })).body.heldPoints).toBe(14);
  });

  it('tracks real staff status changes and pushes them (with consent-gated WhatsApp)', async () => {
    const reg = await inject('POST', '/api/v1/mobile/me/push-devices', { token: tokenA, body: { token: 'ExponentPushToken[device-A-1]', platform: 'android' } });
    expect(reg.status).toBe(201);
    expect((await inject('POST', '/api/v1/mobile/me/push-devices', { token: tokenA, body: { token: 'not-a-token', platform: 'android' } })).status).toBe(400);
    await inject('POST', '/api/v1/mobile/me/consents', { token: tokenA, body: { channel: 'WHATSAPP', purpose: 'TRANSACTIONAL', granted: true } });
    await runMobileTick(); // drains order.placed → "Order placed" push; initialises cursors
    expect(sent.some((s) => s.title === 'Order placed' && s.data.url === `/order/${orderId}`)).toBe(true);

    const patch = await inject('PATCH', `/api/v1/pre-orders/${orderId.slice(3)}`, { token: staffToken, body: { status: 'CONFIRMED' } });
    expect(patch.status).toBe(200);
    expect((await inject('POST', `/api/v1/mobile/me/orders/${orderId}/cancel`, { token: tokenA })).body.code).toBe('NOT_CANCELLABLE');
    await runMobileTick();
    expect(sent.filter((s) => s.title === 'Order accepted')).toHaveLength(1);
    await runMobileTick(); // idempotent — no duplicate push
    expect(sent.filter((s) => s.title === 'Order accepted')).toHaveLength(1);
    const wa = await prisma.notificationLog.findFirst({ where: { channel: 'WHATSAPP' } });
    expect(wa).toMatchObject({ status: 'PROVIDER_NOT_CONFIGURED', kind: 'ORDER_STATUS' });

    const detail = await inject('GET', `/api/v1/mobile/me/orders/${orderId}`, { token: tokenA });
    expect(detail.body.status).toBe('ACCEPTED');
    expect(detail.body.timeline.filter((t: Json) => t.reached).map((t: Json) => t.key)).toEqual(['PLACED', 'ACCEPTED']);
    expect(detail.body.payment).toEqual({ method: 'PAY_AT_PICKUP', status: 'DUE_ON_FULFILMENT' });
  });

  it('settles via the existing POS billing + loyalty code and shows the real receipt', async () => {
    const before = await prisma.customer.findUnique({ where: { id: ids.customerA } });
    // What the cashier's POS bill produces: weighed 1.08 kg, 14 pts redeemed, paid by UPI.
    const sale = await prisma.sale.create({
      data: {
        storeId: ids.store, saleNo: 'S-APP-1', customerId: ids.customerA, status: 'PAID', subTotal: 302.4, grandTotal: 288,
        discountTotal: 0, createdByUserId: ids.cashier,
        items: { create: [{ productId: ids.curry, qtyKg: 1.08, rate: 280, lineTotal: 302.4 }] },
        payments: { create: [{ method: 'UPI', amount: 288 }] },
      },
    });
    await prisma.customer.update({ where: { id: ids.customerA }, data: { loyaltyPoints: before.loyaltyPoints - 14 } });
    await prisma.loyaltyTransaction.create({ data: { customerId: ids.customerA, storeId: ids.store, type: 'REDEEM', points: -14, balance: before.loyaltyPoints - 14, saleId: sale.id } });
    await awardSaleLoyaltyEarn(prisma, { saleId: sale.id, saleNo: 'S-APP-1', customerId: ids.customerA, storeId: ids.store, grandTotal: 288 });
    const f = await inject('POST', '/api/v1/pre-orders/fulfill-by-sale', { token: staffToken, body: { saleId: sale.id, preOrderIds: [orderId.slice(3)] } });
    expect(f.body.fulfilled).toHaveLength(1);
    await runMobileTick(nextIstNoon());

    const detail = await inject('GET', `/api/v1/mobile/me/orders/${orderId}`, { token: tokenA });
    expect(detail.body).toMatchObject({ status: 'COMPLETED', loyaltyHold: { status: 'APPLIED' }, payment: { status: 'PAID' } });
    expect(detail.body.receipt.items[0]).toMatchObject({ grams: 1080, ratePaise: 28000 });
    expect(detail.body.receipt.totalPaise).toBe(28800);
    expect(sent.some((s) => s.title.startsWith('Points earned: +3'))).toBe(true);
    const w = (await inject('GET', '/api/v1/mobile/me/loyalty', { token: tokenA })).body;
    expect(w).toMatchObject({ heldPoints: 0, balance: 189, availablePoints: 189 });
    // The sale is shown once (inside the app order), not duplicated as a walk-in.
    const list = (await inject('GET', '/api/v1/mobile/me/orders', { token: tokenA })).body.orders;
    expect(list.filter((o: Json) => o.id === `sale_${sale.id}`)).toHaveLength(0);
  });

  it('reorders with fresh prices, flags changes and rounds walk-in weights', async () => {
    await prisma.storeProductPrice.create({ data: { storeId: ids.store, productId: ids.curry, pricePerUnit: 300, effectiveFrom: new Date() } });
    const r = await inject('POST', `/api/v1/mobile/me/orders/${orderId}/reorder-quote`, { token: tokenA, body: {} });
    expect(r.status).toBe(200);
    expect(r.body.quote.lines[0]).toMatchObject({ status: 'PRICE_CHANGED', previousRatePaise: 28000, ratePaise: 30000, cutOptionId: 'small', grams: 1000 });
    const w = await inject('POST', `/api/v1/mobile/me/orders/sale_${ids.walkinSale}/reorder-quote`, { token: tokenA, body: {} });
    expect(w.body.adjustedWeights).toBe(1);
    expect(w.body.quote.lines[0].grams).toBe(1250); // weighed 1.13 kg → nearest 250 g step
    // Another customer's order is invisible.
    const other = await prisma.sale.findFirst({ where: { customerId: ids.customerB } });
    expect((await inject('POST', `/api/v1/mobile/me/orders/sale_${other.id}/reorder-quote`, { token: tokenA, body: {} })).status).toBe(404);
    expect((await inject('GET', `/api/v1/mobile/me/orders/sale_${other.id}`, { token: tokenA })).status).toBe(404);
  });

  it('runs weekly plans as reminders only, with skip / pause and one reminder per week', async () => {
    const c = await inject('POST', '/api/v1/mobile/me/weekly-plans', {
      token: tokenA,
      body: { name: 'Sunday curry', storeId: ids.store, items: [{ productId: ids.curry, grams: 1000, cutOptionId: 'medium' }], dayOfWeek: 0, reminderTime: '08:00' },
    });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ dayName: 'Sunday', autoOrder: false, status: 'ACTIVE' });
    const planId = c.body.id;
    const skip = await inject('POST', `/api/v1/mobile/me/weekly-plans/${planId}/skip`, { token: tokenA, body: { date: c.body.upcomingDates[0] } });
    expect(skip.body.nextPlanDate).toBe(c.body.upcomingDates[1]);
    const paused = await inject('PATCH', `/api/v1/mobile/me/weekly-plans/${planId}`, { token: tokenA, body: { status: 'PAUSED' } });
    expect(paused.body.nextReminderAt).toBeNull();
    const resumed = await inject('PATCH', `/api/v1/mobile/me/weekly-plans/${planId}`, { token: tokenA, body: { status: 'ACTIVE' } });
    const due = new Date(resumed.body.nextReminderAt);
    // Suppressed because A placed an app order recently; prove the rule then clear it.
    await prisma.mobileOrder.updateMany({ where: { identityId: { not: '' } }, data: { createdAt: at(30) } });
    const preOrdersBefore = await prisma.preOrder.count();
    await runMobileTick(new Date(due.getTime() + 60_000));
    await runMobileTick(new Date(due.getTime() + 120_000));
    const detail = await inject('GET', `/api/v1/mobile/me/weekly-plans/${planId}`, { token: tokenA });
    expect(detail.body.reminders).toHaveLength(1);
    expect(detail.body.reminders[0]).toMatchObject({ forDate: c.body.upcomingDates[1], status: 'QUEUED' });
    expect(sent.filter((s) => s.data.url?.startsWith(`/weekly-plans/${planId}`))).toHaveLength(1);
    expect(await prisma.preOrder.count()).toBe(preOrdersBefore); // reminders never auto-order
    const rq = await inject('POST', `/api/v1/mobile/me/weekly-plans/${planId}/reorder-quote`, { token: tokenA, body: {} });
    expect(rq.body.quote.lines[0]).toMatchObject({ ratePaise: 30000, cutLabel: 'Medium pieces' });
  });

  it('only sends reorder reminders with marketing consent and records exposure', async () => {
    const t = await login('9811111111', 'B');
    const tokenB = t.accessToken;
    await inject('POST', '/api/v1/mobile/me/push-devices', { token: tokenB, body: { token: 'ExponentPushToken[device-B-1]', platform: 'ios' } });
    const identityB = (await inject('GET', '/api/v1/mobile/me', { token: tokenB })).body.identityId;
    // B buys every 7 days; last purchase 6 days ago → reminder window is [now, now+3d]; next IST noon falls inside it and outside quiet hours.
    const noonIst = nextIstNoon();
    await runMobileTick(noonIst);
    const p = await prisma.reorderPrediction.findUnique({ where: { identityId: identityB } });
    expect(p).toMatchObject({ eligible: true, medianIntervalDays: 7, purchaseCount: 4, ruleVersion: 'median-interval-v1' });
    const log1 = await prisma.notificationLog.findFirst({ where: { identityId: identityB, kind: 'REORDER_REMINDER' } });
    expect(log1).toMatchObject({ status: 'SUPPRESSED', reason: 'NO_MARKETING_CONSENT', isMarketing: true });

    await inject('POST', '/api/v1/mobile/me/consents', { token: tokenB, body: { channel: 'PUSH', purpose: 'MARKETING', granted: true } });
    await prisma.reorderPrediction.update({ where: { identityId: identityB }, data: { computedAt: at(2) } });
    await prisma.notificationLog.deleteMany({ where: { id: log1.id } });
    await prisma.outboxEvent.deleteMany({ where: { dedupeKey: { startsWith: `notify:reorder:${identityB}` } } });
    await runMobileTick(noonIst);
    const log2 = await prisma.notificationLog.findFirst({ where: { identityId: identityB, kind: 'REORDER_REMINDER' } });
    expect(log2.status).toBe('SENT');
    expect(sent.some((s) => s.token === 'ExponentPushToken[device-B-1]' && s.data.url?.startsWith('/reorder/sale_'))).toBe(true);
    expect(await prisma.experimentAssignment.findFirst({ where: { identityId: identityB } })).toMatchObject({ variant: 'TREATMENT' });

    // Opt-out is honoured on the next attempt.
    await inject('POST', '/api/v1/mobile/me/consents', { token: tokenB, body: { channel: 'PUSH', purpose: 'MARKETING', granted: false } });
    const consents = (await inject('GET', '/api/v1/mobile/me/consents', { token: tokenB })).body.consents;
    expect(consents['PUSH:MARKETING'].granted).toBe(false);
    expect(await prisma.communicationConsent.count({ where: { identityId: identityB } })).toBe(2); // full audit trail kept
  });

  it('invalidates dead push tokens', async () => {
    deadTokens.add('ExponentPushToken[device-A-1]');
    const { deliverNotification } = await import('./services/notifications.js');
    const identityA = (await inject('GET', '/api/v1/mobile/me', { token: tokenA })).body.identityId;
    const status = await deliverNotification({ identityId: identityA, kind: 'ORDER_STATUS', title: 't', body: 'b', deepLink: '/orders', dedupeKey: 'dead-token-test' });
    expect(status).toBe('NO_DEVICE');
    expect((await prisma.pushDevice.findUnique({ where: { token: 'ExponentPushToken[device-A-1]' } })).invalidReason).toBe('DeviceNotRegistered');
  });

  it('attributes referrals only to new customers and shows status', async () => {
    const code = (await inject('GET', '/api/v1/mobile/me/referrals', { token: tokenA })).body.code;
    const c = await login('9822222222', 'C', { referralCode: code, name: 'Chetan Rao' });
    expect(c.isNewCustomer).toBe(true);
    const refs = (await inject('GET', '/api/v1/mobile/me/referrals', { token: tokenA })).body;
    expect(refs.friends).toEqual([expect.objectContaining({ firstName: 'Chetan', status: 'PENDING_FIRST_ORDER' })]);
    const self = await inject('POST', '/api/v1/mobile/me/referrals/apply', { token: tokenA, body: { code } });
    expect(self.body.code).toBe('EXISTING_CUSTOMER');
  });

  it('rotates refresh tokens and revokes on logout', async () => {
    const r1 = await inject('POST', '/api/v1/mobile/auth/refresh', { body: { refreshToken: refreshA } });
    expect(r1.status).toBe(200);
    expect((await inject('POST', '/api/v1/mobile/auth/refresh', { body: { refreshToken: refreshA } })).status).toBe(401);
    const out = await inject('POST', '/api/v1/mobile/auth/logout', { token: r1.body.accessToken });
    expect(out.status).toBe(200);
    expect((await inject('GET', '/api/v1/mobile/me', { token: r1.body.accessToken })).status).toBe(401);
    expect((await inject('POST', '/api/v1/mobile/auth/refresh', { body: { refreshToken: r1.body.refreshToken } })).status).toBe(401);
  });

  it('gives staff a retention dashboard and sync health, and protects cron', async () => {
    const dash = await inject('GET', '/api/v1/mobile/admin/retention?weeks=8', { token: ownerToken });
    expect(dash.status).toBe(200);
    expect(dash.body.totals.orders).toBeGreaterThanOrEqual(8);
    expect(dash.body.totals.contributionMargin).toBeNull();
    expect(dash.body.appOrders.placed).toBe(2);
    expect((await inject('GET', '/api/v1/mobile/admin/retention', { token: staffToken })).status).toBe(403);
    const health = await inject('GET', '/api/v1/mobile/admin/sync-health', { token: ownerToken });
    expect(health.body.providers.whatsapp).toBe('not-configured');
    expect((await inject('POST', '/api/v1/mobile/cron/tick')).status).toBe(401);
    expect((await inject('POST', '/api/v1/mobile/cron/tick', { headers: { 'x-vercel-cron': '1' } })).status).toBe(401);
    expect((await inject('POST', '/api/v1/mobile/cron/tick', { headers: { authorization: 'Bearer cron-secret-for-tests' } })).status).toBe(200);
  });

  it('records analytics without PII and handles deletion requests', async () => {
    await prisma.otpChallenge.updateMany({ where: { phone: '9876543210' }, data: { createdAt: at(1) } });
    const t = await login('9876543210', 'A2');
    const a = await inject('POST', '/api/v1/mobile/analytics/events', {
      token: t.accessToken,
      body: { anonymousId: 'anon-1234567', events: [{ name: 'reorder_started', occurredAt: new Date().toISOString(), properties: { orderId: 'po_x', phone: '9876543210' } }, { name: 'evil', occurredAt: new Date().toISOString() }] },
    });
    expect(a.body).toEqual({ accepted: 1, rejected: 1 });
    const ev = await prisma.appAnalyticsEvent.findFirst({ where: { name: 'reorder_started' } });
    expect(ev.properties).toEqual({ orderId: 'po_x' });
    const exp = await inject('GET', '/api/v1/mobile/me/data-export', { token: t.accessToken });
    expect(exp.body.phone).toBe('+919876543210');
    const del = await inject('POST', '/api/v1/mobile/me/deletion-request', { token: t.accessToken });
    expect(del.status).toBe(200);
    expect((await inject('GET', '/api/v1/mobile/me', { token: t.accessToken })).status).toBe(401);
  });
});
