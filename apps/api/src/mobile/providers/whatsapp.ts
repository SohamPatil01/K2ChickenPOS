/**
 * WhatsApp Business messaging. The POS today only builds wa.me deep links for staff to tap
 * (routes/preOrders.ts) — there is no WhatsApp Business API account or provider integration.
 * Automated sends therefore record PROVIDER_NOT_CONFIGURED until an approved BSP / Meta Cloud
 * API account, phone number ID and approved templates exist. Sending only ever happens from
 * backend workers, never from the mobile app.
 */
export type WhatsAppTemplateMessage = {
  toE164: string;
  templateName: string; // must be pre-approved by Meta
  languageCode: string; // e.g. en, mr, hi
  variables: string[];
};

export interface WhatsAppProvider {
  readonly name: string;
  readonly configured: boolean;
  sendTemplate(msg: WhatsAppTemplateMessage): Promise<{ ok: boolean; providerRef?: string; error?: string }>;
}

class NotConfiguredWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'not-configured';
  readonly configured = false;
  async sendTemplate() {
    return { ok: false, error: 'PROVIDER_NOT_CONFIGURED' };
  }
}

/** Templates the business must get approved before any WhatsApp automation can run. */
export const REQUIRED_TEMPLATES = [
  { key: 'order_status_update', category: 'UTILITY', purpose: 'Order accepted / ready / out for delivery' },
  { key: 'weekly_plan_reminder', category: 'UTILITY', purpose: 'Reminder the customer explicitly set up' },
  { key: 'reorder_reminder', category: 'MARKETING', purpose: 'Usual-order nudge (marketing consent required)' },
  { key: 'referral_invite', category: 'MARKETING', purpose: 'Referral campaign (marketing consent required)' },
  { key: 'win_back', category: 'MARKETING', purpose: 'Lapsed customer offer (marketing consent required)' },
] as const;

let override: WhatsAppProvider | null = null;
export function setWhatsAppProviderForTests(p: WhatsAppProvider | null) {
  override = p;
}
export function resolveWhatsAppProvider(): WhatsAppProvider {
  return override ?? new NotConfiguredWhatsAppProvider();
}

/** Inbound STOP/opt-out keywords (processed by the webhook once a provider exists). */
export function isOptOutKeyword(text: string): boolean {
  return /^\s*(stop|unsubscribe|band karo|बंद)\s*$/i.test(text);
}
