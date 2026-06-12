import type { PrismaClient } from '@azela-pos/db';

/** Legacy mirror in CustomerAddress — kept in sync; never deleted on clear */
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

export function withCustomerArea<
  T extends { area?: string | null; addresses?: AddressRow[] },
>(customer: T | null): (Omit<T, 'addresses'> & { area: string | null }) | null {
  if (!customer) return null;
  const { addresses, ...rest } = customer;
  const columnArea = customer.area?.trim();
  const resolved =
    columnArea && columnArea !== PLACEHOLDER
      ? columnArea
      : areaFromAddresses(addresses);
  return { ...rest, area: resolved };
}

export const customerAreaAddressInclude = {
  where: { label: CUSTOMER_AREA_LABEL },
  take: 1,
} as const;

function isMissingCustomerAreaColumn(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || error || '');
  return msg.includes('Customer.area') && msg.includes('does not exist');
}

export async function upsertCustomerArea(
  db: Pick<PrismaClient, 'customerAddress' | 'customer'>,
  customerId: string,
  area: string | null | undefined
): Promise<void> {
  const trimmed = typeof area === 'string' ? area.trim() : '';

  try {
    await db.customer.update({
      where: { id: customerId },
      data: { area: trimmed || null },
    });
  } catch (error) {
    if (!isMissingCustomerAreaColumn(error)) throw error;
  }

  const existing = await db.customerAddress.findFirst({
    where: { customerId, label: CUSTOMER_AREA_LABEL },
  });

  if (!trimmed) {
    if (existing) {
      await db.customerAddress.update({
        where: { id: existing.id },
        data: { line1: PLACEHOLDER },
      });
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

/** Explicit select — safe when nested under Sale.select (no include/select mix). */
export const customerWithAreaInclude = {
  select: {
    id: true,
    name: true,
    phone: true,
    email: true,
    area: true,
    addresses: customerAreaAddressInclude,
  },
};

export function enrichSaleCustomer<S extends { customer?: { addresses?: AddressRow[]; area?: string | null } | null }>(
  sale: S
): S {
  if (!sale?.customer) return sale;
  return { ...sale, customer: withCustomerArea(sale.customer)! };
}
