import type { FastifyInstance } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import {
  addressSchema,
  consentSchema,
  placeOrderSchema,
  prefsSchema,
  profileSchema,
  pushDeviceSchema,
  weeklyPlanPatchSchema,
  weeklyPlanSchema,
} from '../contracts.js';
import { HttpError } from '../errors.js';
import { getRewardsConfig } from '../domain/rewards.js';
import { ctxOf, requireCustomer } from '../auth.js';
import { isExpoPushToken } from '../providers/push.js';
import { computeQuote, placeOrder, quoteResponse } from '../services/checkout.js';
import { getCatalog } from '../services/catalog.js';
import { currentConsents, getPrefs, prefsToDto, recordConsent, savePrefs } from '../services/consents.js';
import { applyReferralCode } from '../services/identity.js';
import { getWallet } from '../services/loyalty.js';
import { cancelOrder, getOrder, lastReorderable, listOrders, reorderLines } from '../services/orders.js';
import { recommendations } from '../services/personalization.js';
import { createPlan, deletePlan, getPlan, listPlans, planLines, skipPlanDate, updatePlan } from '../services/plans.js';
import { revokeAllSessions } from '../services/session.js';
import { ensureReferralCode } from '../../lib/referral.js';
import { grantProfileRewardIfEligible } from '../../lib/profileReward.js';

const idParam = z.object({ id: z.string().min(1).max(80) });
const reorderBody = z.object({ storeId: z.string().max(64).optional(), fulfillment: z.enum(['PICKUP', 'DELIVERY']).optional(), addressId: z.string().max(64).optional().nullable() });

export async function mobileMeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireCustomer);

  app.get('/me', async (request) => {
    const ctx = ctxOf(request);
    const [identity, customer] = await Promise.all([
      prisma.customerIdentity.findUnique({ where: { id: ctx.identityId } }),
      prisma.customer.findUnique({ where: { id: ctx.primaryCustomerId }, select: { name: true, loyaltyTier: true, referralCode: true, storeId: true } }),
    ]);
    return {
      identityId: ctx.identityId,
      phone: `+91${ctx.phone}`,
      name: customer?.name ?? null,
      tier: customer?.loyaltyTier ?? 'BRONZE',
      referralCode: customer?.referralCode ?? (await ensureReferralCode(prisma, ctx.primaryCustomerId)),
      linkedPurchaseProfiles: ctx.customerIds.length,
      verifiedAt: identity?.verifiedAt.toISOString(),
      verificationMethod: identity?.verificationMethod,
      deletionRequestedAt: identity?.deletionRequestedAt?.toISOString() ?? null,
    };
  });

  app.patch('/me', async (request) => {
    const ctx = ctxOf(request);
    const { name } = profileSchema.parse(request.body);
    await prisma.customer.update({ where: { id: ctx.primaryCustomerId }, data: { name } });
    await grantProfileRewardIfEligible(prisma, ctx.primaryCustomerId, 'portal');
    return { ok: true, name };
  });

  // ---------- addresses (existing POS CustomerAddress table) ----------
  app.get('/me/addresses', async (request) => {
    const ctx = ctxOf(request);
    const rows = await prisma.customerAddress.findMany({
      where: { customerId: { in: ctx.customerIds }, label: { not: 'Area' } },
      orderBy: { updatedAt: 'desc' },
    });
    return { addresses: rows.map(({ customerId: _c, ...a }) => a) };
  });

  app.post('/me/addresses', async (request, reply) => {
    const ctx = ctxOf(request);
    const data = addressSchema.parse(request.body);
    const count = await prisma.customerAddress.count({ where: { customerId: ctx.primaryCustomerId } });
    if (count >= 10) throw new HttpError(409, 'ADDRESS_LIMIT', 'You can save up to 10 addresses');
    const a = await prisma.customerAddress.create({
      data: {
        customerId: ctx.primaryCustomerId,
        label: data.label ?? 'Home',
        line1: data.line1 as string,
        line2: data.line2 ?? null,
        city: data.city ?? 'Pune',
        state: data.state ?? 'Maharashtra',
        zip: data.zip as string,
        geoLat: data.geoLat ?? null,
        geoLng: data.geoLng ?? null,
      },
    });
    await grantProfileRewardIfEligible(prisma, ctx.primaryCustomerId, 'portal');
    reply.code(201);
    const { customerId: _c, ...rest } = a;
    return rest;
  });

  app.put('/me/addresses/:id', async (request) => {
    const ctx = ctxOf(request);
    const { id } = idParam.parse(request.params);
    const data = addressSchema.parse(request.body);
    const res = await prisma.customerAddress.updateMany({ where: { id, customerId: { in: ctx.customerIds } }, data: { ...data, line2: data.line2 ?? null } });
    if (res.count !== 1) throw new HttpError(404, 'NOT_FOUND', 'Address not found');
    return { ok: true };
  });

  app.delete('/me/addresses/:id', async (request) => {
    const ctx = ctxOf(request);
    const { id } = idParam.parse(request.params);
    const res = await prisma.customerAddress.deleteMany({ where: { id, customerId: { in: ctx.customerIds } } });
    if (res.count !== 1) throw new HttpError(404, 'NOT_FOUND', 'Address not found');
    return { ok: true };
  });

  // ---------- home ----------
  app.get('/me/home', async (request) => {
    const ctx = ctxOf(request);
    const storeId = z.object({ storeId: z.string().min(1).max(64) }).parse(request.query).storeId;
    const [last, wallet, plans, open, catalog] = await Promise.all([
      lastReorderable(ctx),
      getWallet(ctx),
      listPlans(ctx),
      listOrders(ctx, { limit: 5 }),
      getCatalog(storeId).catch(() => null),
    ]);
    const recs = await recommendations(ctx.identityId, new Set(catalog?.products.filter((p) => p.inStock).map((p) => p.id) ?? []));
    return {
      lastOrder: last,
      rewards: { availablePoints: wallet.availablePoints, heldPoints: wallet.heldPoints, tier: wallet.tier, milestone: wallet.milestone },
      activePlans: plans.filter((p) => p.status === 'ACTIVE'),
      openOrders: open.orders.filter((o) => ['PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status)),
      recommendedProductIds: recs.productIds,
      recommendationBasis: recs.basis,
    };
  });

  // ---------- orders ----------
  app.post('/orders', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const ctx = ctxOf(request);
    const key = String(request.headers['idempotency-key'] || '');
    const body = placeOrderSchema.parse(request.body);
    const result = await placeOrder(ctx, body, key);
    reply.code(result.replayed ? 200 : 201);
    return { order: await getOrder(ctx, result.orderId), replayed: result.replayed };
  });

  app.get('/me/orders', async (request) => {
    const ctx = ctxOf(request);
    const q = z.object({ before: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(request.query);
    return listOrders(ctx, { before: q.before ? new Date(q.before) : undefined, limit: q.limit });
  });

  app.get('/me/orders/:id', async (request) => getOrder(ctxOf(request), idParam.parse(request.params).id));

  app.post('/me/orders/:id/cancel', async (request) => ({ order: await cancelOrder(ctxOf(request), idParam.parse(request.params).id) }));

  app.post('/me/orders/:id/reorder-quote', async (request) => {
    const ctx = ctxOf(request);
    const { id } = idParam.parse(request.params);
    const body = reorderBody.parse(request.body ?? {});
    const src = await reorderLines(ctx, id);
    const { quote, config } = await computeQuote(ctx, {
      storeId: body.storeId ?? src.storeId,
      fulfillment: body.fulfillment ?? 'PICKUP',
      addressId: body.addressId ?? null,
      lines: src.lines,
      redeemPoints: 0,
    });
    return { sourceOrderId: id, storeId: body.storeId ?? src.storeId, adjustedWeights: src.adjustedWeights, ...quoteResponse(quote, config) };
  });

  // ---------- rewards & referrals ----------
  app.get('/me/loyalty', async (request) => getWallet(ctxOf(request)));

  app.get('/me/referrals', async (request) => {
    const ctx = ctxOf(request);
    const code = await ensureReferralCode(prisma, ctx.primaryCustomerId);
    const [friends, bonuses] = await Promise.all([
      prisma.customer.findMany({
        where: { referredByCustomerId: { in: ctx.customerIds } },
        select: { name: true, createdAt: true, referralBonusAwardedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.loyaltyTransaction.aggregate({ where: { customerId: { in: ctx.customerIds }, type: 'REFERRAL' }, _sum: { points: true } }),
    ]);
    const base = process.env.MOBILE_REFERRAL_LINK_BASE;
    return {
      code,
      shareUrl: base ? `${base.replace(/\/$/, '')}?code=${encodeURIComponent(code)}` : null,
      appLink: `k2chicken://referral/${code}`,
      rules: 'Your friend signs up with your code. When they complete and pay for their first order, you both receive bonus points. Installing the app alone does not earn rewards.',
      bonusPointsEach: getRewardsConfig().referralBonusPoints,
      totalBonusPoints: Math.round(bonuses._sum.points ?? 0),
      friends: friends.map((f) => ({
        firstName: (f.name || 'Friend').split(' ')[0].slice(0, 20),
        joinedAt: f.createdAt.toISOString(),
        status: f.referralBonusAwardedAt ? 'REWARDED' : 'PENDING_FIRST_ORDER',
      })),
    };
  });

  app.post('/me/referrals/apply', async (request) => {
    const ctx = ctxOf(request);
    const { code } = z.object({ code: z.string().trim().min(4).max(12) }).parse(request.body);
    const res = await applyReferralCode(ctx.identityId, ctx.primaryCustomerId, code);
    if (!res.linked) {
      const msg: Record<string, string> = {
        EXISTING_CUSTOMER: 'Referral codes are for new customers before their first order.',
        INVALID_CODE: 'That referral code was not found.',
        SELF_REFERRAL: 'You cannot use your own code.',
        REFERRER_CAP_REACHED: 'This code has reached its monthly limit.',
        ALREADY_REFERRED: 'A referral code is already linked to your account.',
      };
      throw new HttpError(400, res.reason ?? 'REFERRAL_FAILED', msg[res.reason ?? ''] ?? 'Could not apply code');
    }
    return { ok: true };
  });

  // ---------- consents & notification settings ----------
  app.get('/me/consents', async (request) => ({ consents: await currentConsents(ctxOf(request).identityId) }));

  app.post('/me/consents', async (request) => {
    const ctx = ctxOf(request);
    const body = consentSchema.parse(request.body);
    await recordConsent({ identityId: ctx.identityId, channel: body.channel, purpose: body.purpose, granted: body.granted, source: body.source ?? 'APP_SETTINGS' });
    return { consents: await currentConsents(ctx.identityId) };
  });

  app.get('/me/notification-preferences', async (request) => prefsToDto(await getPrefs(ctxOf(request).identityId)));

  app.put('/me/notification-preferences', async (request) => {
    const ctx = ctxOf(request);
    await savePrefs(ctx.identityId, prefsSchema.parse(request.body));
    return prefsToDto(await getPrefs(ctx.identityId));
  });

  app.get('/me/notifications', async (request) => {
    const ctx = ctxOf(request);
    const rows = await prisma.notificationLog.findMany({
      where: { identityId: ctx.identityId, status: 'SENT', channel: 'PUSH' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, title: true, deepLink: true, createdAt: true },
    });
    return { notifications: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  });

  app.post('/me/push-devices', async (request, reply) => {
    const ctx = ctxOf(request);
    const body = pushDeviceSchema.parse(request.body);
    if (!isExpoPushToken(body.token)) throw new HttpError(400, 'INVALID_PUSH_TOKEN', 'Unsupported push token');
    // A token belongs to one device; re-registering moves it to the current identity/session (token rotation / account switch).
    const d = await prisma.pushDevice.upsert({
      where: { token: body.token },
      create: { identityId: ctx.identityId, sessionId: ctx.sessionId, token: body.token, platform: body.platform, appVersion: body.appVersion ?? null },
      update: { identityId: ctx.identityId, sessionId: ctx.sessionId, platform: body.platform, appVersion: body.appVersion ?? null, lastSeenAt: new Date(), invalidatedAt: null, invalidReason: null },
    });
    reply.code(201);
    return { id: d.id };
  });

  app.delete('/me/push-devices/:id', async (request) => {
    const ctx = ctxOf(request);
    const { id } = idParam.parse(request.params);
    const res = await prisma.pushDevice.updateMany({ where: { id, identityId: ctx.identityId }, data: { invalidatedAt: new Date(), invalidReason: 'USER_UNREGISTERED' } });
    if (res.count !== 1) throw new HttpError(404, 'NOT_FOUND', 'Device not found');
    return { ok: true };
  });

  // ---------- weekly plans (reminders only — never auto-ordered or auto-charged) ----------
  app.get('/me/weekly-plans', async (request) => ({ plans: await listPlans(ctxOf(request)) }));
  app.post('/me/weekly-plans', async (request, reply) => {
    reply.code(201);
    return createPlan(ctxOf(request), weeklyPlanSchema.parse(request.body));
  });
  app.get('/me/weekly-plans/:id', async (request) => getPlan(ctxOf(request), idParam.parse(request.params).id));
  app.patch('/me/weekly-plans/:id', async (request) =>
    updatePlan(ctxOf(request), idParam.parse(request.params).id, weeklyPlanPatchSchema.parse(request.body))
  );
  app.delete('/me/weekly-plans/:id', async (request) => {
    await deletePlan(ctxOf(request), idParam.parse(request.params).id);
    return { ok: true };
  });
  app.post('/me/weekly-plans/:id/skip', async (request) => {
    const { date, skip } = z.object({ date: z.string(), skip: z.boolean().default(true) }).parse(request.body);
    return skipPlanDate(ctxOf(request), idParam.parse(request.params).id, date, skip);
  });
  app.post('/me/weekly-plans/:id/reorder-quote', async (request) => {
    const ctx = ctxOf(request);
    const { id } = idParam.parse(request.params);
    const { storeId, lines, plan } = await planLines(ctx, id);
    const { quote, config } = await computeQuote(ctx, {
      storeId,
      fulfillment: plan.fulfillment === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
      addressId: plan.addressId,
      lines,
      redeemPoints: 0,
    });
    return { planId: id, storeId, ...quoteResponse(quote, config) };
  });

  // ---------- data rights ----------
  app.get('/me/data-export', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request) => {
    const ctx = ctxOf(request);
    const [customers, addresses, loyalty, consents, plans, orders, devices] = await Promise.all([
      prisma.customer.findMany({ where: { id: { in: ctx.customerIds } }, select: { id: true, name: true, phone: true, email: true, area: true, loyaltyPoints: true, loyaltyTier: true, createdAt: true } }),
      prisma.customerAddress.findMany({ where: { customerId: { in: ctx.customerIds } } }),
      prisma.loyaltyTransaction.findMany({ where: { customerId: { in: ctx.customerIds } }, select: { type: true, points: true, balance: true, description: true, createdAt: true } }),
      prisma.communicationConsent.findMany({ where: { identityId: ctx.identityId } }),
      prisma.weeklyPlan.findMany({ where: { identityId: ctx.identityId } }),
      listOrders(ctx, { limit: 50 }),
      prisma.pushDevice.findMany({ where: { identityId: ctx.identityId }, select: { platform: true, createdAt: true, invalidatedAt: true } }),
    ]);
    await prisma.dataRightsRequest.create({ data: { identityId: ctx.identityId, type: 'EXPORT', status: 'COMPLETED', completedAt: new Date() } });
    return { generatedAt: new Date().toISOString(), phone: `+91${ctx.phone}`, customers, addresses, loyalty, consents, weeklyPlans: plans, recentOrders: orders.orders, devices };
  });

  app.post('/me/deletion-request', async (request) => {
    const ctx = ctxOf(request);
    const existing = await prisma.dataRightsRequest.findFirst({ where: { identityId: ctx.identityId, type: 'DELETE', status: 'REQUESTED' } });
    if (!existing) {
      await prisma.dataRightsRequest.create({
        data: { identityId: ctx.identityId, type: 'DELETE', note: 'Requested in app. Staff to anonymise POS customer rows after statutory retention review.' },
      });
    }
    await prisma.customerIdentity.update({ where: { id: ctx.identityId }, data: { deletionRequestedAt: new Date() } });
    for (const channel of ['PUSH', 'WHATSAPP']) {
      await recordConsent({ identityId: ctx.identityId, channel, purpose: 'MARKETING', granted: false, source: 'APP_SETTINGS' });
    }
    await prisma.weeklyPlan.updateMany({ where: { identityId: ctx.identityId }, data: { status: 'PAUSED', nextReminderAt: null } });
    await revokeAllSessions(ctx.identityId, 'DELETION_REQUESTED');
    return {
      ok: true,
      message:
        'Your deletion request was received. You have been signed out and marketing has been switched off. Billing records the store must keep by law are retained; everything else is removed after review.',
    };
  });
}
