import { prisma } from '@azela-pos/db';
import { DEFAULT_HOURS, parseHours, type WeeklyHours } from '../domain/slots.js';

export type CutOption = { id: string; label: string };

/**
 * Piece-size options shown for KG products. The POS has no per-product cut catalogue (cuts such as
 * curry-cut or boneless are separate products), so these are PRE-CONFIGURED DEFAULTS pending store
 * confirmation. Store owners can replace them per store via MobileStoreConfig.cutOptionsJson
 * (an empty array hides the selector).
 */
export const DEFAULT_CUT_OPTIONS: CutOption[] = [
  { id: 'small', label: 'Small pieces' },
  { id: 'medium', label: 'Medium pieces' },
  { id: 'large', label: 'Large pieces' },
];

export type StoreCommerceConfig = {
  storeId: string;
  appOrderingEnabled: boolean;
  deliveryEnabled: boolean;
  serviceablePincodes: string[];
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
  slotMinutes: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
  hours: WeeklyHours;
  cutOptions: CutOption[];
  customerCancelWindow: 'PENDING_ONLY' | 'NONE';
  supportPhone: string | null;
};

function parseCuts(raw: unknown): CutOption[] {
  if (!Array.isArray(raw)) return DEFAULT_CUT_OPTIONS;
  return raw
    .filter((c): c is CutOption => !!c && typeof c.id === 'string' && typeof c.label === 'string')
    .slice(0, 12)
    .map((c) => ({ id: c.id.slice(0, 32), label: c.label.slice(0, 60) }));
}

export async function getStoreConfig(storeId: string): Promise<StoreCommerceConfig> {
  const row = await prisma.mobileStoreConfig.findUnique({ where: { storeId } });
  return {
    storeId,
    appOrderingEnabled: row?.appOrderingEnabled ?? true,
    deliveryEnabled: row?.deliveryEnabled ?? false,
    serviceablePincodes: row?.serviceablePincodes ?? [],
    deliveryFeePaise: row?.deliveryFeePaise ?? 0,
    freeDeliveryAbovePaise: row?.freeDeliveryAbovePaise ?? null,
    minOrderPaise: row?.minOrderPaise ?? 0,
    slotMinutes: row?.slotMinutes ?? 60,
    leadTimeMinutes: row?.leadTimeMinutes ?? 60,
    maxDaysAhead: row?.maxDaysAhead ?? 3,
    hours: row?.hoursJson ? parseHours(row.hoursJson) : DEFAULT_HOURS,
    cutOptions: row?.cutOptionsJson ? parseCuts(row.cutOptionsJson) : DEFAULT_CUT_OPTIONS,
    customerCancelWindow: row?.customerCancelWindow === 'NONE' ? 'NONE' : 'PENDING_ONLY',
    supportPhone: row?.supportPhone ?? process.env.MOBILE_SUPPORT_PHONE ?? null,
  };
}

export function isPincodeServiceable(cfg: StoreCommerceConfig, pincode: string | null | undefined): boolean {
  const z = String(pincode || '').trim();
  return cfg.deliveryEnabled && /^\d{6}$/.test(z) && cfg.serviceablePincodes.includes(z);
}
