import type { WeeklyHours } from './slots.js';
import { addDaysYmd, istParts, minutesToHhmm, weekdayOfYmd } from './time.js';

export type OpenStatus = {
  openNow: boolean;
  /** "HH:mm" IST when currently open */
  closesAt: string | null;
  /** next opening (IST) when currently closed */
  nextOpen: { ymd: string; time: string } | null;
};

export type DayHours = { weekday: number; open: string | null; close: string | null };

/** Open/closed right now plus the next opening, from the store's weekly IST hours. */
export function openStatus(now: Date, hours: WeeklyHours): OpenStatus {
  const { ymd, minutes } = istParts(now);
  const today = hours[String(weekdayOfYmd(ymd))];
  if (today && minutes >= today[0] && minutes < today[1]) {
    return { openNow: true, closesAt: minutesToHhmm(today[1]), nextOpen: null };
  }
  for (let i = 0; i <= 7; i++) {
    const day = addDaysYmd(ymd, i);
    const h = hours[String(weekdayOfYmd(day))];
    if (!h) continue;
    if (i === 0 && minutes >= h[0]) continue; // today's opening already passed
    return { openNow: false, closesAt: null, nextOpen: { ymd: day, time: minutesToHhmm(h[0]) } };
  }
  return { openNow: false, closesAt: null, nextOpen: null };
}

/** Week starting Monday, as shown on shop signboards. */
export function weekHours(hours: WeeklyHours): DayHours[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const h = hours[String(weekday)];
    return { weekday, open: h ? minutesToHhmm(h[0]) : null, close: h ? minutesToHhmm(h[1]) : null };
  });
}
