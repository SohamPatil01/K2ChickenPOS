/** Store business calendar — India (IST). Used for daily closing & payment tallies. */
export const STORE_TIMEZONE = 'Asia/Kolkata';
export const STORE_TZ_OFFSET = '+05:30';

/** yyyy-MM-dd for a timestamp in the store timezone. */
export function ymdInStoreTz(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });
}

/** Inclusive start/end instants for one store-calendar day (yyyy-MM-dd). */
export function storeDayBoundsFromYmd(ymd: string): { gte: Date; lte: Date } {
  const day = String(ymd).split('T')[0];
  return {
    gte: new Date(`${day}T00:00:00.000${STORE_TZ_OFFSET}`),
    lte: new Date(`${day}T23:59:59.999${STORE_TZ_OFFSET}`),
  };
}

/** Parse API date params: ISO instants pass through; yyyy-MM-dd uses store TZ. */
export function parseStoreDateRange(
  startDate?: string,
  endDate?: string
): { gte: Date; lte: Date } | null {
  if (!startDate && !endDate) return null;
  if (startDate && endDate) {
    if (String(startDate).includes('T') && String(endDate).includes('T')) {
      return { gte: new Date(startDate), lte: new Date(endDate) };
    }
    const startStr = String(startDate).split('T')[0];
    const endStr = String(endDate).split('T')[0];
    return {
      gte: new Date(`${startStr}T00:00:00.000${STORE_TZ_OFFSET}`),
      lte: new Date(`${endStr}T23:59:59.999${STORE_TZ_OFFSET}`),
    };
  }
  const single = String((startDate || endDate)!).split('T')[0];
  return storeDayBoundsFromYmd(single);
}

/** yyyy-MM-dd N days before a store-calendar day (default: today in store TZ). */
export function ymdDaysAgoInStoreTz(days: number, from: Date = new Date()): string {
  const anchor = new Date(`${ymdInStoreTz(from)}T12:00:00.000${STORE_TZ_OFFSET}`);
  anchor.setDate(anchor.getDate() - days);
  return ymdInStoreTz(anchor);
}

/**
 * Resolve API/report date bounds. yyyy-MM-dd uses IST; missing end → today;
 * missing start → `defaultDaysBack` store days before end.
 */
export function resolveStoreDateRange(
  startDate?: string,
  endDate?: string,
  defaultDaysBack = 29
): { gte: Date; lte: Date } {
  const endYmd = endDate ? String(endDate).split('T')[0] : ymdInStoreTz();
  const startYmd = startDate
    ? String(startDate).split('T')[0]
    : ymdDaysAgoInStoreTz(defaultDaysBack, new Date(`${endYmd}T12:00:00.000${STORE_TZ_OFFSET}`));
  return parseStoreDateRange(startYmd, endYmd)!;
}

/** Midnight store-local for the sale's business day (stored on Sale.businessDate). */
export function businessDateForNow(at: Date = new Date()): Date {
  const ymd = ymdInStoreTz(at);
  return new Date(`${ymd}T00:00:00.000${STORE_TZ_OFFSET}`);
}

/** Stable DB key for DailyClosing.closingDate unique constraint. */
export function closingDateStorageKey(ymd: string): Date {
  return new Date(`${String(ymd).split('T')[0]}T00:00:00.000Z`);
}

/** Prisma filter: sales in [gte, lte] by businessDate or createdAt fallback. */
export function salesInDateRangeWhere(gte: Date, lte: Date) {
  return {
    OR: [
      { businessDate: { gte, lte } },
      { AND: [{ businessDate: null }, { createdAt: { gte, lte } }] },
    ],
  };
}

/** Prisma where-clause: PAID sales belonging to one store calendar day. */
export function salesInStoreDayWhere(
  storeId: string,
  ymd: string,
  status: 'PAID' | 'OPEN' | 'VOID' = 'PAID'
) {
  const { gte, lte } = storeDayBoundsFromYmd(ymd);
  return {
    storeId,
    status,
    ...salesInDateRangeWhere(gte, lte),
  };
}
