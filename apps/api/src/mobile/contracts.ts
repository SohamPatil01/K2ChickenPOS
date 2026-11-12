import { z } from 'zod';

export const lineSchema = z.object({
  productId: z.string().min(1).max(64),
  grams: z.number().int().positive().max(10_000).optional().nullable(),
  pieces: z.number().int().positive().max(50).optional().nullable(),
  cutOptionId: z.string().max(32).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  previousRatePaise: z.number().int().nonnegative().optional().nullable(),
});

export const quoteRequestSchema = z.object({
  storeId: z.string().min(1).max(64),
  fulfillment: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  addressId: z.string().max(64).optional().nullable(),
  lines: z.array(lineSchema).max(30),
  redeemPoints: z.number().int().nonnegative().max(100_000).default(0),
});

export const placeOrderSchema = quoteRequestSchema.extend({
  lines: z.array(lineSchema).min(1).max(30),
  slotStart: z.string().datetime(),
  paymentMethod: z.enum(['PAY_AT_PICKUP', 'PAY_ON_DELIVERY']),
  /** Total the customer confirmed on screen. Mismatch → 409 so they re-confirm. */
  confirmedTotalPaise: z.number().int().nonnegative(),
  notes: z.string().max(300).optional().nullable(),
  source: z.enum(['CART', 'REORDER', 'WEEKLY_PLAN']).default('CART'),
  sourceRef: z.string().max(80).optional().nullable(),
});

export const otpRequestSchema = z.object({ phone: z.string().min(10).max(16) });
export const otpVerifySchema = z.object({
  phone: z.string().min(10).max(16),
  challengeId: z.string().min(1).max(64),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(80).optional(),
  referralCode: z.string().trim().max(12).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().max(32).optional(),
});
export const pinLoginSchema = z.object({
  phone: z.string().min(10).max(16),
  pin: z.string().regex(/^\d{4,6}$/),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().max(32).optional(),
});
/** Lookup whether this POS phone already has a loyalty PIN (same field as points.k2chicken.com). */
export const pinLookupSchema = z.object({ phone: z.string().min(10).max(16) });
/**
 * First-time PIN set for a POS number that has no portalPinHash yet (or a brand-new customer).
 * Same hash field as the loyalty portal — one PIN for both surfaces.
 */
export const pinClaimSchema = z.object({
  phone: z.string().min(10).max(16),
  pin: z.string().regex(/^\d{4,6}$/),
  name: z.string().trim().min(2).max(80).optional(),
  referralCode: z.string().trim().max(12).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().max(32).optional(),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default('Home'),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(2).max(60).default('Pune'),
  state: z.string().trim().min(2).max(60).default('Maharashtra'),
  zip: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  geoLat: z.number().min(-90).max(90).optional().nullable(),
  geoLng: z.number().min(-180).max(180).optional().nullable(),
});

export const profileSchema = z.object({ name: z.string().trim().min(2).max(80) });

export const planItemSchema = z.object({
  productId: z.string().min(1).max(64),
  grams: z.number().int().positive().max(10_000).optional().nullable(),
  pieces: z.number().int().positive().max(50).optional().nullable(),
  cutOptionId: z.string().max(32).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

export const weeklyPlanSchema = z.object({
  name: z.string().trim().min(1).max(60).default('My weekly chicken'),
  storeId: z.string().min(1).max(64),
  items: z.array(planItemSchema).min(1).max(10),
  dayOfWeek: z.number().int().min(0).max(6),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  fulfillment: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  addressId: z.string().max(64).optional().nullable(),
  slotPreference: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
});
export const weeklyPlanPatchSchema = weeklyPlanSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

export const consentSchema = z.object({
  channel: z.enum(['PUSH', 'WHATSAPP']),
  purpose: z.enum(['MARKETING', 'TRANSACTIONAL']),
  granted: z.boolean(),
  source: z.enum(['APP_SETTINGS', 'APP_ONBOARDING']).default('APP_SETTINGS'),
});

export const prefsSchema = z.object({
  orderUpdates: z.boolean(),
  planReminders: z.boolean(),
  rewardUpdates: z.boolean(),
  reorderReminders: z.boolean(),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  maxMarketingPerWeek: z.number().int().min(0).max(7),
});

export const pushDeviceSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().max(32).optional(),
});

export const analyticsBatchSchema = z.object({
  anonymousId: z.string().min(8).max(64),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().max(32).optional(),
  events: z
    .array(
      z.object({
        name: z.string().max(40),
        occurredAt: z.string().datetime(),
        properties: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(50),
});
