import type { FastifyInstance } from 'fastify';
import { prisma, Prisma } from '@azela-pos/db';
import { z } from 'zod';
import { analyticsBatchSchema, quoteRequestSchema } from '../contracts.js';
import { ANALYTICS_EVENTS, sanitizeProperties } from '../domain/analyticsEvents.js';
import { getRewardsConfig } from '../domain/rewards.js';
import { PIECE_RULES, WEIGHT_RULES } from '../domain/quote.js';
import { optionalCustomer } from '../auth.js';
import { resolveOtpSender } from '../providers/otpSender.js';
import { PAYMENT_METHODS, WEIGHT_PRICING_DISCLOSURE } from '../providers/payments.js';
import { getCatalog, getProduct, listStores } from '../services/catalog.js';
import { computeQuote, quoteResponse } from '../services/checkout.js';
import { CONSENT_POLICY_VERSION } from '../services/consents.js';

const storeParams = z.object({ storeId: z.string().min(1).max(64) });

export async function mobilePublicRoutes(app: FastifyInstance) {
  app.get('/config', async () => {
    const r = getRewardsConfig();
    return {
      apiVersion: 1,
      minSupportedAppVersion: process.env.MOBILE_MIN_APP_VERSION || '1.0.0',
      auth: { otpAvailable: resolveOtpSender().configured, portalPinLogin: process.env.MOBILE_ALLOW_PORTAL_PIN_LOGIN !== 'false' },
      weightRules: WEIGHT_RULES,
      pieceRules: PIECE_RULES,
      paymentMethods: PAYMENT_METHODS,
      onlinePaymentAvailable: false,
      pricingDisclosure: WEIGHT_PRICING_DISCLOSURE,
      rewards: { pointValuePaise: r.pointValuePaise, maxRedeemPercent: r.maxRedeemPercent, minPointsToRedeem: r.minPointsToRedeem, policyVersion: r.policyVersion },
      consentPolicyVersion: CONSENT_POLICY_VERSION,
      support: { phone: process.env.MOBILE_SUPPORT_PHONE || null, email: process.env.MOBILE_SUPPORT_EMAIL || null },
      legal: { privacyPolicyUrl: process.env.MOBILE_PRIVACY_URL || null, termsUrl: process.env.MOBILE_TERMS_URL || null },
      timezone: 'Asia/Kolkata',
      serverTime: new Date().toISOString(),
    };
  });

  app.get('/stores', async (_req, reply) => {
    // private/no-store: public CDN cache can pin a single Access-Control-Allow-Origin
    reply.header('Cache-Control', 'private, no-store');
    return { stores: await listStores() };
  });

  app.get('/stores/:storeId/catalog', async (request, reply) => {
    const { storeId } = storeParams.parse(request.params);
    // Short cache: prices/stock change during the day; checkout always re-quotes anyway.
    reply.header('Cache-Control', 'private, max-age=30');
    return getCatalog(storeId);
  });

  app.get('/stores/:storeId/products/:productId', async (request, reply) => {
    const { storeId, productId } = storeParams.extend({ productId: z.string().min(1).max(64) }).parse(request.params);
    reply.header('Cache-Control', 'private, max-age=30');
    return getProduct(storeId, productId);
  });

  /** Authoritative pricing for a cart (guest or signed in). */
  app.post('/checkout/quotes', { preHandler: optionalCustomer }, async (request) => {
    const body = quoteRequestSchema.parse(request.body);
    const { quote, config } = await computeQuote(request.mobileCtx ?? null, body);
    return quoteResponse(quote, config);
  });

  app.post(
    '/analytics/events',
    { preHandler: optionalCustomer, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const body = analyticsBatchSchema.parse(request.body);
      const allowed = new Set<string>(ANALYTICS_EVENTS);
      const now = Date.now();
      const rows = body.events
        .filter((e) => allowed.has(e.name))
        .map((e) => {
          const t = new Date(e.occurredAt).getTime();
          return {
            name: e.name,
            identityId: request.mobileCtx?.identityId ?? null,
            anonymousId: body.anonymousId,
            properties: sanitizeProperties(e.properties) as Prisma.InputJsonValue,
            platform: body.platform ?? null,
            appVersion: body.appVersion ?? null,
            // Clamp client clocks: no future events, nothing older than 7 days.
            occurredAt: new Date(Math.min(now, Math.max(now - 7 * 86_400_000, t))),
          };
        });
      if (rows.length) await prisma.appAnalyticsEvent.createMany({ data: rows });
      return { accepted: rows.length, rejected: body.events.length - rows.length };
    }
  );
}
