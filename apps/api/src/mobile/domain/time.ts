/**
 * Asia/Kolkata helpers. IST is a fixed UTC+05:30 offset with no DST, so plain offset
 * arithmetic is exact. All customer-facing scheduling uses server time + IST.
 */
export const IST_OFFSET_MINUTES = 330;
export const STORE_TIMEZONE = 'Asia/Kolkata';

export type IstParts = { ymd: string; weekday: number; minutes: number };

export function istParts(d: Date): IstParts {
  const shifted = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  const ymd = shifted.toISOString().slice(0, 10);
  return {
    ymd,
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Instant for yyyy-MM-dd + minutes-after-midnight in IST. */
export function istDateAt(ymd: string, minutes: number): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0) + (minutes - IST_OFFSET_MINUTES) * 60_000;
  return new Date(utcMs);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Quiet window [start, end) in minutes; supports windows that wrap midnight. */
export function isWithinWindow(minutes: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
