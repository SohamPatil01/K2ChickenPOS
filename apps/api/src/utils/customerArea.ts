import type { PrismaClient } from '@azela-pos/db';

/** Stored as a CustomerAddress row — no extra DB columns required */
export const CUSTOMER_AREA_LABEL = 'Area';
const PLACEHOLDER = '—';

type AddressRow = { label: string; line1: string };

export function areaFromAddresses(
  addresses?: AddressRow[] | null
): string | null {
  if (!addresses?.length) return null;
  const row = addresses.find((a) => a.label === CUSTOMER_AREA_LABEL);
  const value = row?.line1?.trim();
  if (!value || value === PLACEHOLDER) return null;
  return value;
}

export function withCustomerArea<T extends { addresses?: AddressRow[] }>(
  customer: T | null
): (Omit<T, 'addresses'> & { area: string | null }) | null {
  if (!customer) return null;
  const { addresses, ...rest } = customer;
  return { ...rest, area: areaFromAddresses(addresses) };
}

export const customerAreaAddressInclude = {
  where: { label: CUSTOMER_AREA_LABEL },
  take: 1,
} as const;

export async function upsertCustomerArea(
  db: Pick<PrismaClient, 'customerAddress'>,
  customerId: string,
  area: string | null | undefined
): Promise<void> {
  const trimmed = typeof area === 'string' ? area.trim() : '';
  const existing = await db.customerAddress.findFirst({
    where: { customerId, label: CUSTOMER_AREA_LABEL },
  });

  if (!trimmed) {
    if (existing) {
      await db.customerAddress.delete({ where: { id: existing.id } });
    }
    return;
  }

  if (existing) {
    await db.customerAddress.update({
      where: { id: existing.id },
      data: { line1: trimmed },
    });
    return;
  }

  await db.customerAddress.create({
    data: {
      customerId,
      label: CUSTOMER_AREA_LABEL,
      line1: trimmed,
      city: PLACEHOLDER,
      state: PLACEHOLDER,
      zip: PLACEHOLDER,
    },
  });
}

export const customerWithAreaInclude = {
  include: {
    addresses: customerAreaAddressInclude,
  },
};

export function enrichSaleCustomer<S extends { customer?: { addresses?: AddressRow[] } | null }>(
  sale: S
): S {
  if (!sale?.customer) return sale;
  return { ...sale, customer: withCustomerArea(sale.customer)! };
}
