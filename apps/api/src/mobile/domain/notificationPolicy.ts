import { isWithinWindow, istParts } from './time.js';

export type NotificationKind = 'ORDER_STATUS' | 'PLAN_REMINDER' | 'REWARD' | 'REORDER_REMINDER' | 'PROMO';

export type Prefs = {
  orderUpdates: boolean;
  planReminders: boolean;
  rewardUpdates: boolean;
  reorderReminders: boolean;
  quietStartMinutes: number;
  quietEndMinutes: number;
  maxMarketingPerWeek: number;
};

export const DEFAULT_PREFS: Prefs = {
  orderUpdates: true,
  planReminders: true,
  rewardUpdates: true,
  reorderReminders: true,
  quietStartMinutes: 21 * 60 + 30,
  quietEndMinutes: 8 * 60,
  maxMarketingPerWeek: 2,
};

/** Marketing = anything not directly requested by an action the customer took. */
export function isMarketingKind(kind: NotificationKind): boolean {
  return kind === 'REORDER_REMINDER' || kind === 'PROMO';
}

export type SendDecision = { allowed: boolean; reason?: string };

export function decideSend(args: {
  kind: NotificationKind;
  prefs: Prefs;
  /** Explicit marketing consent for this channel (latest audit row). */
  marketingConsent: boolean;
  marketingSentLast7Days: number;
  now: Date;
  /** Customer opted out of everything / requested deletion. */
  suppressed: boolean;
  /** Holdout group in a retention experiment — record exposure, do not send. */
  holdout?: boolean;
}): SendDecision {
  const { kind, prefs, now } = args;
  if (args.suppressed) return { allowed: false, reason: 'SUPPRESSED' };
  const toggle: Record<NotificationKind, boolean> = {
    ORDER_STATUS: prefs.orderUpdates,
    PLAN_REMINDER: prefs.planReminders,
    REWARD: prefs.rewardUpdates,
    REORDER_REMINDER: prefs.reorderReminders,
    PROMO: true,
  };
  if (!toggle[kind]) return { allowed: false, reason: 'PREFERENCE_OFF' };
  if (isMarketingKind(kind)) {
    if (!args.marketingConsent) return { allowed: false, reason: 'NO_MARKETING_CONSENT' };
    if (args.holdout) return { allowed: false, reason: 'EXPERIMENT_HOLDOUT' };
    if (args.marketingSentLast7Days >= prefs.maxMarketingPerWeek) return { allowed: false, reason: 'FREQUENCY_CAP' };
  }
  // Order status updates are transactional and time-sensitive: not held by quiet hours.
  if (kind !== 'ORDER_STATUS' && isWithinWindow(istParts(now).minutes, prefs.quietStartMinutes, prefs.quietEndMinutes)) {
    return { allowed: false, reason: 'QUIET_HOURS' };
  }
  return { allowed: true };
}
