import type { FastifyInstance } from 'fastify';
import { prisma, Prisma } from '@azela-pos/db';
import { z } from 'zod';
import { getUser, requireRole } from '../../utils/auth.js';
import { HttpError } from '../errors.js';
import { getStoreConfig } from '../services/config.js';
import { retentionDashboard, syncHealth } from '../services/retention.js';
import { REQUIRED_TEMPLATES, resolveWhatsAppProvider } from '../providers/whatsapp.js';
import { resolveOtpSender } from '../providers/otpSender.js';

const configSchema = z.object({
  appOrderingEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  serviceablePincodes: z.array(z.string().regex(/^\d{6}$/)).max(200),
  deliveryFeePaise: z.number().int().min(0).max(100_000),
  freeDeliveryAbovePaise: z.number().int().min(0).max(10_000_000).nullable(),
  minOrderPaise: z.number().int().min(0).max(10_000_000),
  slotMinutes: z.number().int().refine((v) => [30, 60, 90, 120].includes(v)),
  leadTimeMinutes: z.number().int().min(20).max(1440),
  maxDaysAhead: z.number().int().min(0).max(14),
  hours: z.record(z.tuple([z.number().int().min(0).max(1440), z.number().int().min(0).max(1440)]).nullable()),
  cutOptions: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,32}$/), label: z.string().min(1).max(60) })).max(12),
  customerCancelWindow: z.enum(['PENDING_ONLY', 'NONE']),
  supportPhone: z.string().regex(/^\+?\d{10,13}$/).nullable(),
});

/** Staff-only (existing POS JWT + role). Customer tokens are rejected by fastify.authenticate. */
export async function mobileAdminRoutes(app: FastifyInstance) {
  const guard = { preHandler: [app.authenticate, requireRole('OWNER', 'MANAGER')] };

  app.get('/admin/retention', guard, async (request) => {
    const q = z.object({ weeks: z.coerce.number().int().default(8), storeId: z.string().optional() }).parse(request.query);
    const user = getUser(request);
    const storeIds = user.role === 'OWNER' ? (q.storeId ? [q.storeId] : null) : [user.storeId];
    return retentionDashboard({ storeIds, weeks: q.weeks });
  });

  app.get('/admin/sync-health', guard, async () => ({
    ...(await syncHealth()),
    providers: {
      otp: resolveOtpSender().name,
      whatsapp: resolveWhatsAppProvider().name,
      whatsappTemplatesRequired: REQUIRED_TEMPLATES,
      push: process.env.EXPO_ACCESS_TOKEN ? 'expo (access token set)' : 'expo (no access token)',
    },
  }));

  app.get('/admin/store-config/:storeId', guard, async (request) => {
    const { storeId } = z.object({ storeId: z.string() }).parse(request.params);
    const user = getUser(request);
    if (user.role !== 'OWNER' && user.storeId !== storeId) throw new HttpError(403, 'FORBIDDEN', 'Forbidden');
    return getStoreConfig(storeId);
  });

  app.put('/admin/store-config/:storeId', guard, async (request) => {
    const { storeId } = z.object({ storeId: z.string() }).parse(request.params);
    const user = getUser(request);
    if (user.role !== 'OWNER' && user.storeId !== storeId) throw new HttpError(403, 'FORBIDDEN', 'Forbidden');
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) throw new HttpError(404, 'STORE_NOT_FOUND', 'Store not found');
    const c = configSchema.parse(request.body);
    const data = {
      appOrderingEnabled: c.appOrderingEnabled,
      deliveryEnabled: c.deliveryEnabled,
      serviceablePincodes: c.serviceablePincodes,
      deliveryFeePaise: c.deliveryFeePaise,
      freeDeliveryAbovePaise: c.freeDeliveryAbovePaise,
      minOrderPaise: c.minOrderPaise,
      slotMinutes: c.slotMinutes,
      leadTimeMinutes: c.leadTimeMinutes,
      maxDaysAhead: c.maxDaysAhead,
      hoursJson: c.hours as Prisma.InputJsonValue,
      cutOptionsJson: c.cutOptions as Prisma.InputJsonValue,
      customerCancelWindow: c.customerCancelWindow,
      supportPhone: c.supportPhone,
    };
    await prisma.mobileStoreConfig.upsert({ where: { storeId }, create: { storeId, ...data }, update: data });
    await prisma.auditLog.create({
      data: { storeId, actorUserId: user.userId, action: 'MOBILE_STORE_CONFIG_UPDATED', entityType: 'MobileStoreConfig', entityId: storeId, metaJson: data as Prisma.InputJsonValue },
    });
    return getStoreConfig(storeId);
  });
}
