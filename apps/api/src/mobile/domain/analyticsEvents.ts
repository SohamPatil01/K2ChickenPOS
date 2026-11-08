/**
 * Privacy-conscious analytics: fixed event names, whitelisted primitive properties only.
 * No names, phone numbers, addresses or free text are accepted.
 */
export const ANALYTICS_EVENTS = [
  'app_opened',
  'sign_up_completed',
  'product_viewed',
  'add_to_cart',
  'checkout_started',
  'checkout_completed',
  'reorder_card_viewed',
  'reorder_started',
  'reorder_quote_created',
  'reorder_cart_modified',
  'reorder_checkout_started',
  'reorder_completed',
  'reorder_failed',
  'loyalty_viewed',
  'loyalty_redeemed',
  'weekly_plan_created',
  'referral_shared',
  'push_opened',
  'push_permission_result',
  'campaign_conversion',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const ALLOWED_PROPS = new Set([
  'productId',
  'storeId',
  'orderId',
  'source',
  'grams',
  'pieces',
  'totalPaise',
  'itemCount',
  'unavailableCount',
  'priceChangedCount',
  'points',
  'reason',
  'notificationKind',
  'campaignKey',
  'granted',
  'screen',
  'durationMs',
]);

export function sanitizeProperties(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_PROPS.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 64 && /^[\w.:-]*$/.test(v)) out[k] = v;
  }
  return out;
}
