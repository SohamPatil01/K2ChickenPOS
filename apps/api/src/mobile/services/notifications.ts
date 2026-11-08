import { prisma, Prisma } from '@azela-pos/db';
import { decideSend, isMarketingKind, type NotificationKind } from '../domain/notificationPolicy.js';
import { REORDER_REMINDER_EXPERIMENT, variantFor } from '../domain/experiments.js';
import { resolvePushProvider } from '../providers/push.js';
import { currentConsents, getPrefs } from './consents.js';
import { enqueueOutbox } from './outbox.js';

type Tx = Prisma.TransactionClient;

export type NotificationPayload = {
  identityId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** In-app route, validated by the app's deep-link allowlist. */
  deepLink: string;
  campaignKey?: string;
};

export async function enqueueNotification(db: Tx | typeof prisma, dedupeKey: string, n: NotificationPayload, availableAt?: Date) {
  return enqueueOutbox(db, {
    type: 'notification.requested',
    aggregateType: 'CustomerIdentity',
    aggregateId: n.identityId,
    dedupeKey: `notify:${dedupeKey}`,
    payload: { ...n, dedupeKey },
    availableAt,
  });
}

export function holdoutPercent(): number {
  const v = Number(process.env.MOBILE_REORDER_HOLDOUT_PERCENT);
  return Number.isFinite(v) ? v : 10;
}

/** Stable experiment assignment, persisted so analysis can join on it. */
export async function ensureAssignment(identityId: string, experimentKey: string): Promise<'HOLDOUT' | 'TREATMENT'> {
  const existing = await prisma.experimentAssignment.findUnique({ where: { identityId_experimentKey: { identityId, experimentKey } } });
  if (existing) return existing.variant as 'HOLDOUT' | 'TREATMENT';
  const variant = variantFor(identityId, experimentKey, holdoutPercent());
  await prisma.experimentAssignment.createMany({ data: [{ identityId, experimentKey, variant }], skipDuplicates: true });
  return variant;
}

/**
 * Policy check + push send + log, for one requested notification. Idempotent on dedupeKey via
 * NotificationLog's unique index: a second attempt for the same event is a no-op.
 */
export async function deliverNotification(p: NotificationPayload & { dedupeKey: string }, now = new Date()): Promise<string> {
  const already = await prisma.notificationLog.findUnique({ where: { dedupeKey: p.dedupeKey }, select: { status: true } });
  if (already && already.status !== 'FAILED') return already.status;

  const identity = await prisma.customerIdentity.findUnique({ where: { id: p.identityId }, select: { deletionRequestedAt: true } });
  const prefs = await getPrefs(p.identityId);
  const consents = await currentConsents(p.identityId);
  const marketing = isMarketingKind(p.kind);
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const marketingSentLast7Days = marketing
    ? await prisma.notificationLog.count({ where: { identityId: p.identityId, isMarketing: true, status: 'SENT', createdAt: { gte: since } } })
    : 0;
  const holdout = p.kind === 'REORDER_REMINDER' ? (await ensureAssignment(p.identityId, REORDER_REMINDER_EXPERIMENT)) === 'HOLDOUT' : false;

  const decision = decideSend({
    kind: p.kind,
    prefs,
    marketingConsent: consents['PUSH:MARKETING'].granted,
    marketingSentLast7Days,
    now,
    suppressed: !!identity?.deletionRequestedAt || !identity,
    holdout,
  });

  const log = async (status: string, reason?: string, providerRef?: string) => {
    await prisma.notificationLog.upsert({
      where: { dedupeKey: p.dedupeKey },
      create: {
        identityId: p.identityId,
        kind: p.kind,
        channel: 'PUSH',
        isMarketing: marketing,
        dedupeKey: p.dedupeKey,
        status,
        reason: reason ?? null,
        title: p.title.slice(0, 120),
        deepLink: p.deepLink,
        providerRef: providerRef ?? null,
        campaignKey: p.campaignKey ?? null,
      },
      update: { status, reason: reason ?? null, providerRef: providerRef ?? null },
    });
    return status;
  };

  if (!decision.allowed) return log('SUPPRESSED', decision.reason);

  const devices = await prisma.pushDevice.findMany({ where: { identityId: p.identityId, invalidatedAt: null } });
  if (!devices.length) return log('NO_DEVICE');

  const results = await resolvePushProvider().send(
    devices.map((d) => ({
      token: d.token,
      title: p.title,
      body: p.body,
      data: { url: p.deepLink, kind: p.kind, dedupeKey: p.dedupeKey },
      channelId: p.kind === 'ORDER_STATUS' ? 'orders' : 'default',
    }))
  );
  for (const r of results) {
    if (r.status === 'error' && r.invalidToken) {
      await prisma.pushDevice.updateMany({ where: { token: r.token }, data: { invalidatedAt: now, invalidReason: 'DeviceNotRegistered' } });
    }
  }
  const ok = results.filter((r) => r.status === 'ok');
  if (ok.length) return log('SENT', undefined, ok.map((r) => (r.status === 'ok' ? r.ticketId : '')).filter(Boolean).join(',').slice(0, 190));
  const firstErr = results.find((r) => r.status === 'error');
  const transient = results.some((r) => r.status === 'error' && !r.invalidToken);
  await log(transient ? 'FAILED' : 'NO_DEVICE', firstErr && firstErr.status === 'error' ? firstErr.error : undefined);
  if (transient) throw new Error(`push failed: ${firstErr && firstErr.status === 'error' ? firstErr.error : 'unknown'}`);
  return 'NO_DEVICE';
}
