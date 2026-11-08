import { prisma } from '@azela-pos/db';
import { decideSend, isMarketingKind } from '../domain/notificationPolicy.js';
import { toE164India } from '../domain/phone.js';
import { resolveWhatsAppProvider } from '../providers/whatsapp.js';
import { currentConsents, getPrefs } from './consents.js';
import type { NotificationPayload } from './notifications.js';

const TEMPLATE_FOR: Partial<Record<NotificationPayload['kind'], string>> = {
  ORDER_STATUS: 'order_status_update',
  PLAN_REMINDER: 'weekly_plan_reminder',
  REORDER_REMINDER: 'reorder_reminder',
};

/**
 * WhatsApp is only attempted with explicit WhatsApp consent for the purpose (transactional or
 * marketing). Entering a phone number at checkout is NOT consent. Every attempt is logged,
 * including PROVIDER_NOT_CONFIGURED, so staff can see exactly why nothing was sent.
 */
export async function maybeSendWhatsApp(p: NotificationPayload & { dedupeKey: string }, now = new Date()): Promise<string | null> {
  const template = TEMPLATE_FOR[p.kind];
  if (!template) return null;
  const consents = await currentConsents(p.identityId);
  const marketing = isMarketingKind(p.kind);
  const consentKey = marketing ? 'WHATSAPP:MARKETING' : 'WHATSAPP:TRANSACTIONAL';
  if (!consents[consentKey].granted) return null;
  const dedupeKey = `wa:${p.dedupeKey}`;
  if (await prisma.notificationLog.findUnique({ where: { dedupeKey }, select: { id: true } })) return 'DUPLICATE';

  const identity = await prisma.customerIdentity.findUnique({ where: { id: p.identityId }, select: { phone: true, deletionRequestedAt: true } });
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const decision = decideSend({
    kind: p.kind,
    prefs: await getPrefs(p.identityId),
    marketingConsent: consents['WHATSAPP:MARKETING'].granted,
    marketingSentLast7Days: marketing
      ? await prisma.notificationLog.count({ where: { identityId: p.identityId, isMarketing: true, status: 'SENT', createdAt: { gte: since } } })
      : 0,
    now,
    suppressed: !identity || !!identity.deletionRequestedAt,
  });
  let status = 'SUPPRESSED';
  let reason: string | null = decision.allowed ? null : (decision.reason ?? null);
  let providerRef: string | null = null;
  if (decision.allowed && identity) {
    const provider = resolveWhatsAppProvider();
    const res = await provider.sendTemplate({ toE164: toE164India(identity.phone), templateName: template, languageCode: 'en', variables: [p.body] });
    status = res.ok ? 'SENT' : res.error === 'PROVIDER_NOT_CONFIGURED' ? 'PROVIDER_NOT_CONFIGURED' : 'FAILED';
    reason = res.ok ? null : res.error ?? null;
    providerRef = res.providerRef ?? null;
  }
  await prisma.notificationLog.create({
    data: {
      identityId: p.identityId,
      kind: p.kind,
      channel: 'WHATSAPP',
      isMarketing: marketing,
      dedupeKey,
      status,
      reason,
      title: template,
      deepLink: p.deepLink,
      providerRef,
      campaignKey: p.campaignKey ?? null,
    },
  });
  return status;
}
