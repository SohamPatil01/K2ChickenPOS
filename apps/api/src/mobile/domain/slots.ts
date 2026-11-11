import { addDaysYmd, istDateAt, istParts, minutesToHhmm, weekdayOfYmd } from './time.js';

/** Open/close minutes per weekday (0=Sun). null = closed. */
export type WeeklyHours = Record<string, [number, number] | null>;

/**
 * Default hours taken from the store info already published in apps/loyalty-web/src/lib/shop.ts:
 * Mon closed; Thu 08:00–13:00; other days 08:00–20:00. Override per store in MobileStoreConfig.hoursJson.
 */
export const DEFAULT_HOURS: WeeklyHours = {
  '0': [480, 1200],
  '1': null,
  '2': [480, 1200],
  '3': [480, 1200],
  '4': [480, 780],
  '5': [480, 1200],
  '6': [480, 1200],
};

export type Slot = { start: string; end: string; ymd: string; label: string };

export function parseHours(raw: unknown): WeeklyHours {
  if (!raw || typeof raw !== 'object') return DEFAULT_HOURS;
  const out: WeeklyHours = {};
  for (let d = 0; d < 7; d++) {
    const v = (raw as Record<string, unknown>)[String(d)];
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      v.every((n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 1440) &&
      (v[0] as number) < (v[1] as number)
    ) {
      out[String(d)] = [v[0] as number, v[1] as number];
    } else {
      out[String(d)] = null;
    }
  }
  return out;
}

export function generateSlots(args: {
  now: Date;
  hours: WeeklyHours;
  slotMinutes: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
}): Slot[] {
  const { now, hours, slotMinutes, leadTimeMinutes, maxDaysAhead } = args;
  const earliest = now.getTime() + leadTimeMinutes * 60_000;
  const today = istParts(now).ymd;
  const slots: Slot[] = [];
  for (let i = 0; i <= maxDaysAhead; i++) {
    const ymd = addDaysYmd(today, i);
    const h = hours[String(weekdayOfYmd(ymd))];
    if (!h) continue;
    for (let start = h[0]; start + slotMinutes <= h[1]; start += slotMinutes) {
      const s = istDateAt(ymd, start);
      if (s.getTime() < earliest) continue;
      const e = istDateAt(ymd, start + slotMinutes);
      slots.push({
        start: s.toISOString(),
        end: e.toISOString(),
        ymd,
        label: `${minutesToHhmm(start)}–${minutesToHhmm(start + slotMinutes)}`,
      });
    }
  }
  return slots;
}

export function isValidSlot(slots: Slot[], start: string): Slot | null {
  const t = new Date(start).getTime();
  return slots.find((s) => new Date(s.start).getTime() === t) ?? null;
}
