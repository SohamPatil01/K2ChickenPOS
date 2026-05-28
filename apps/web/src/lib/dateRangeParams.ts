import { endOfDay, format, parse, startOfDay, subDays } from 'date-fns';

/** Parse yyyy-MM-dd as a local calendar day (not UTC midnight). */
export function parseLocalYmd(ymd: string): Date {
  return parse(ymd, 'yyyy-MM-dd', new Date());
}

/** Local calendar day bounds → ISO instants for API + yyyy-MM-dd for businessDate. */
export function localDateRangeToApiBounds(startYmd: string, endYmd: string) {
  const startLocal = startOfDay(parseLocalYmd(startYmd));
  const endLocal = endOfDay(parseLocalYmd(endYmd));
  return {
    startDate: startLocal.toISOString(),
    endDate: endLocal.toISOString(),
    businessDayStart: startYmd,
    businessDayEnd: endYmd,
  };
}

export function defaultDateRangeLast30Days() {
  const end = new Date();
  const start = subDays(end, 30);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function defaultDateRangeLast7Days() {
  const end = new Date();
  const start = subDays(end, 6);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function todayLocalYmd(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
