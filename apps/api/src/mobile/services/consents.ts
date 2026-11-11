import { prisma } from '@azela-pos/db';
import { DEFAULT_PREFS, type Prefs } from '../domain/notificationPolicy.js';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time.js';

export const CONSENT_POLICY_VERSION = process.env.MOBILE_CONSENT_POLICY_VERSION || 'comms-2026-11';

export type ConsentKey = `${'PUSH' | 'WHATSAPP'}:${'MARKETING' | 'TRANSACTIONAL'}`;

/** Current consent = latest audit row. No row = not granted (opt-in only). */
export async function currentConsents(identityId: string): Promise<Record<ConsentKey, { granted: boolean; at: string | null; source: string | null }>> {
  const rows = await prisma.communicationConsent.findMany({ where: { identityId }, orderBy: { createdAt: 'desc' } });
  const keys: ConsentKey[] = ['PUSH:MARKETING', 'PUSH:TRANSACTIONAL', 'WHATSAPP:MARKETING', 'WHATSAPP:TRANSACTIONAL'];
  const out = {} as Record<ConsentKey, { granted: boolean; at: string | null; source: string | null }>;
  for (const k of keys) {
    const [channel, purpose] = k.split(':');
    const r = rows.find((x) => x.channel === channel && x.purpose === purpose);
    out[k] = { granted: r?.granted ?? false, at: r?.createdAt.toISOString() ?? null, source: r?.source ?? null };
  }
  return out;
}

export async function recordConsent(args: { identityId: string; channel: string; purpose: string; granted: boolean; source: string }) {
  await prisma.communicationConsent.create({ data: { ...args, policyVersion: CONSENT_POLICY_VERSION } });
}

export async function getPrefs(identityId: string): Promise<Prefs> {
  const row = await prisma.notificationPreference.findUnique({ where: { identityId } });
  return row
    ? {
        orderUpdates: row.orderUpdates,
        planReminders: row.planReminders,
        rewardUpdates: row.rewardUpdates,
        reorderReminders: row.reorderReminders,
        quietStartMinutes: row.quietStartMinutes,
        quietEndMinutes: row.quietEndMinutes,
        maxMarketingPerWeek: row.maxMarketingPerWeek,
      }
    : DEFAULT_PREFS;
}

export function prefsToDto(p: Prefs) {
  return {
    orderUpdates: p.orderUpdates,
    planReminders: p.planReminders,
    rewardUpdates: p.rewardUpdates,
    reorderReminders: p.reorderReminders,
    quietStart: minutesToHhmm(p.quietStartMinutes),
    quietEnd: minutesToHhmm(p.quietEndMinutes),
    maxMarketingPerWeek: p.maxMarketingPerWeek,
  };
}

export async function savePrefs(identityId: string, dto: Partial<ReturnType<typeof prefsToDto>>) {
  const data = {
    orderUpdates: dto.orderUpdates ?? DEFAULT_PREFS.orderUpdates,
    planReminders: dto.planReminders ?? DEFAULT_PREFS.planReminders,
    rewardUpdates: dto.rewardUpdates ?? DEFAULT_PREFS.rewardUpdates,
    reorderReminders: dto.reorderReminders ?? DEFAULT_PREFS.reorderReminders,
    quietStartMinutes: hhmmToMinutes(dto.quietStart ?? '') ?? DEFAULT_PREFS.quietStartMinutes,
    quietEndMinutes: hhmmToMinutes(dto.quietEnd ?? '') ?? DEFAULT_PREFS.quietEndMinutes,
    maxMarketingPerWeek: dto.maxMarketingPerWeek ?? DEFAULT_PREFS.maxMarketingPerWeek,
  };
  await prisma.notificationPreference.upsert({ where: { identityId }, create: { identityId, ...data }, update: data });
}
