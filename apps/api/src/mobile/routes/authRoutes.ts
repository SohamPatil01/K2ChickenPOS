import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@azela-pos/db';
import { otpRequestSchema, otpVerifySchema, pinClaimSchema, pinLoginSchema, pinLookupSchema, refreshSchema } from '../contracts.js';
import {
  generateOtp,
  hashIp,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  otpMatches,
} from '../domain/otp.js';
import { normalizeIndianMobile, posPhoneVariants, toE164India } from '../domain/phone.js';
import { HttpError } from '../errors.js';
import { otpEchoEnabled, resolveOtpSender } from '../providers/otpSender.js';
import { ctxOf, requireCustomer } from '../auth.js';
import { establishIdentity, resolveDefaultOwnerStoreId } from '../services/identity.js';
import { createSession, refreshSession, revokeSession } from '../services/session.js';

let dummy: string | null = null;
const dummyHash = () => (dummy ??= bcrypt.hashSync('not-a-real-pin', 10));

const strict = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });

function phoneOrThrow(raw: string): string {
  const phone = normalizeIndianMobile(raw);
  if (!phone) throw new HttpError(400, 'INVALID_PHONE', 'Enter a valid 10-digit Indian mobile number');
  return phone;
}

export async function mobileAuthRoutes(app: FastifyInstance) {
  app.post('/auth/otp/request', strict(5), async (request, reply) => {
    const body = otpRequestSchema.parse(request.body);
    const phone = phoneOrThrow(body.phone);
    const sender = resolveOtpSender();
    if (!sender.configured) {
      throw new HttpError(503, 'OTP_PROVIDER_NOT_CONFIGURED', 'Phone verification is not available yet. Please try again later.');
    }
    const now = Date.now();
    const recent = await prisma.otpChallenge.findMany({
      where: { phone, createdAt: { gte: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent.length >= OTP_MAX_PER_HOUR) {
      throw new HttpError(429, 'OTP_RATE_LIMITED', 'Too many codes requested. Try again in an hour.');
    }
    const since = recent[0] ? (now - recent[0].createdAt.getTime()) / 1000 : Infinity;
    if (since < OTP_RESEND_COOLDOWN_SECONDS) {
      const retryAfter = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - since);
      reply.header('Retry-After', String(retryAfter));
      throw new HttpError(429, 'OTP_COOLDOWN', `Please wait ${retryAfter}s before requesting another code`, { retryAfterSeconds: retryAfter });
    }
    const code = generateOtp();
    const challenge = await prisma.otpChallenge.create({
      data: { phone, codeHash: 'pending', expiresAt: new Date(now + OTP_TTL_SECONDS * 1000), maxAttempts: OTP_MAX_ATTEMPTS, ipHash: hashIp(request.ip) },
    });
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { codeHash: hashOtp(phone, code, challenge.id) } });
    const sent = await sender.send({ phoneE164: toE164India(phone), code, ttlSeconds: OTP_TTL_SECONDS });
    if (!sent.ok) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw new HttpError(502, 'OTP_SEND_FAILED', 'Could not send the code. Please try again.');
    }
    // Existing-customer hint is deliberately NOT returned (prevents phone-number enumeration).
    return {
      challengeId: challenge.id,
      expiresInSeconds: OTP_TTL_SECONDS,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      ...(otpEchoEnabled() ? { devCode: code } : {}),
    };
  });

  app.post('/auth/otp/verify', strict(10), async (request) => {
    const body = otpVerifySchema.parse(request.body);
    const phone = phoneOrThrow(body.phone);
    const challenge = await prisma.otpChallenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.phone !== phone || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      throw new HttpError(400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new HttpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Request a new code.');
    }
    // Count the attempt BEFORE comparing so parallel guesses cannot exceed the limit.
    const bumped = await prisma.otpChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: challenge.maxAttempts }, consumedAt: null },
      data: { attempts: { increment: 1 } },
    });
    if (bumped.count !== 1) throw new HttpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Request a new code.');
    if (!otpMatches(challenge.codeHash, phone, body.code, challenge.id)) {
      const left = challenge.maxAttempts - challenge.attempts - 1;
      throw new HttpError(400, 'OTP_INCORRECT', left > 0 ? `Incorrect code. ${left} attempt(s) left.` : 'Incorrect code. Request a new one.');
    }
    const consumed = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) throw new HttpError(400, 'OTP_EXPIRED', 'This code was already used.');

    const { identityId, isNewCustomer } = await establishIdentity({ phone, method: 'OTP', name: body.name, referralCode: body.referralCode });
    const tokens = await createSession(app, identityId, { platform: body.platform, appVersion: body.appVersion });
    return { ...tokens, isNewCustomer };
  });

  /**
   * Existing loyalty-portal customers (points.k2chicken.com) can sign in with the PIN they already
   * set, while an SMS provider is pending. Only accounts that already HAVE a PIN — this cannot be
   * used to claim a number.
   */
  app.post('/auth/pin/login', strict(10), async (request) => {
    if (process.env.MOBILE_ALLOW_PORTAL_PIN_LOGIN === 'false') throw new HttpError(404, 'NOT_FOUND', 'Not found');
    const body = pinLoginSchema.parse(request.body);
    const phone = phoneOrThrow(body.phone);
    // Same branching as the loyalty portal: unknown number / no PIN yet / wrong PIN.
    const customers = await prisma.customer.findMany({
      where: { phone: { in: posPhoneVariants(phone) } },
      select: { portalPinHash: true },
    });
    if (!customers.length) {
      await bcrypt.compare(body.pin, dummyHash());
      throw new HttpError(404, 'NOT_FOUND', 'No account found. Please register.');
    }
    const candidates = customers.filter((c) => c.portalPinHash);
    if (!candidates.length) {
      await bcrypt.compare(body.pin, dummyHash());
      throw new HttpError(404, 'NO_PIN', 'Set a PIN first (register or claim this number).');
    }
    let ok = false;
    for (const c of candidates) if (c.portalPinHash && (await bcrypt.compare(body.pin, c.portalPinHash))) ok = true;
    if (!ok) throw new HttpError(401, 'PIN_INCORRECT', 'Incorrect PIN');
    const { identityId } = await establishIdentity({ phone, method: 'PORTAL_PIN' });
    return { ...(await createSession(app, identityId, { platform: body.platform, appVersion: body.appVersion })), isNewCustomer: false };
  });

  /** Same trust model as the loyalty portal lookup — used to branch login vs first-time PIN set. */
  app.post('/auth/pin/lookup', strict(20), async (request) => {
    if (process.env.MOBILE_ALLOW_PORTAL_PIN_LOGIN === 'false') throw new HttpError(404, 'NOT_FOUND', 'Not found');
    const body = pinLookupSchema.parse(request.body);
    const phone = phoneOrThrow(body.phone);
    const customers = await prisma.customer.findMany({
      where: { phone: { in: posPhoneVariants(phone) } },
      select: { name: true, portalPinHash: true, loyaltyPoints: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!customers.length) return { exists: false, hasPin: false, name: null as string | null };
    const withPin = customers.find((c) => c.portalPinHash);
    const pick = withPin ?? [...customers].sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0))[0]!;
    return { exists: true, hasPin: Boolean(pick.portalPinHash), name: pick.name || null };
  });

  /**
   * First-time set of the shared loyalty PIN (Customer.portalPinHash), then open an app session.
   * Refuses if a PIN already exists — those users must use /auth/pin/login.
   */
  app.post('/auth/pin/claim', strict(5), async (request) => {
    if (process.env.MOBILE_ALLOW_PORTAL_PIN_LOGIN === 'false') throw new HttpError(404, 'NOT_FOUND', 'Not found');
    const body = pinClaimSchema.parse(request.body);
    const phone = phoneOrThrow(body.phone);
    const customers = await prisma.customer.findMany({
      where: { phone: { in: posPhoneVariants(phone) } },
      select: { id: true, name: true, portalPinHash: true, loyaltyPoints: true, storeId: true },
      orderBy: { updatedAt: 'desc' },
    });
    const withPin = customers.find((c) => c.portalPinHash);
    if (withPin) throw new HttpError(409, 'ALREADY_REGISTERED', 'This phone already has a PIN. Please sign in.');

    const ownerStoreId = await resolveDefaultOwnerStoreId();
    const ranked = [...customers].sort(
      (a, b) => Number(b.storeId === ownerStoreId) - Number(a.storeId === ownerStoreId) || (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0)
    );
    const existing = ranked[0] ?? null;
    const name = (body.name?.trim() || existing?.name || '').trim();
    if (!existing && name.length < 2) throw new HttpError(400, 'NAME_REQUIRED', 'Enter your name to create an account');

    const pinHash = await bcrypt.hash(body.pin, 10);
    const now = new Date();
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { portalPinHash: pinHash, portalRegisteredAt: now, ...(name && !existing.name ? { name } : {}) },
      });
    } else {
      if (!ownerStoreId) throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'Store is not configured');
      await prisma.customer.create({
        data: {
          storeId: ownerStoreId,
          name,
          phone,
          loyaltyPoints: 0,
          loyaltyTier: 'BRONZE',
          totalSpent: 0,
          portalPinHash: pinHash,
          portalRegisteredAt: now,
        },
      });
    }

    const { identityId, isNewCustomer } = await establishIdentity({
      phone,
      method: 'PORTAL_PIN',
      name: name || undefined,
      referralCode: body.referralCode,
    });
    return {
      ...(await createSession(app, identityId, { platform: body.platform, appVersion: body.appVersion })),
      isNewCustomer: isNewCustomer || !existing,
    };
  });

  app.post('/auth/refresh', strict(30), async (request) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    return refreshSession(app, refreshToken);
  });

  app.post('/auth/logout', { preHandler: requireCustomer }, async (request) => {
    await revokeSession(ctxOf(request).sessionId, 'LOGOUT');
    return { ok: true };
  });
}
