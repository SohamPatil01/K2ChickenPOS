import { addDaysYmd, istDateAt, istParts, weekdayOfYmd } from './time.js';

export type PlanSchedule = {
  dayOfWeek: number; // 0..6, IST
  reminderMinutes: number; // minutes after midnight IST
  /** How many days before the plan day the reminder fires (0 = same day). */
  reminderLeadDays?: number;
  skipDates: string[];
  status: 'ACTIVE' | 'PAUSED';
};

/** Next plan day (yyyy-MM-dd, IST) whose reminder instant is strictly after `now`. */
export function nextPlanOccurrence(plan: PlanSchedule, now: Date): { forDate: string; remindAt: Date } | null {
  if (plan.status !== 'ACTIVE') return null;
  const lead = plan.reminderLeadDays ?? 0;
  const today = istParts(now).ymd;
  for (let i = 0; i < 7 * 9; i++) {
    const ymd = addDaysYmd(today, i);
    if (weekdayOfYmd(ymd) !== plan.dayOfWeek) continue;
    if (plan.skipDates.includes(ymd)) continue;
    const remindAt = istDateAt(addDaysYmd(ymd, -lead), plan.reminderMinutes);
    if (remindAt.getTime() > now.getTime()) return { forDate: ymd, remindAt };
  }
  return null;
}

/** Upcoming plan dates (for "skip a week" UI). */
export function upcomingPlanDates(plan: Pick<PlanSchedule, 'dayOfWeek'>, now: Date, count = 4): string[] {
  const today = istParts(now).ymd;
  const out: string[] = [];
  for (let i = 0; out.length < count && i < 7 * (count + 1); i++) {
    const ymd = addDaysYmd(today, i);
    if (weekdayOfYmd(ymd) === plan.dayOfWeek) out.push(ymd);
  }
  return out;
}

export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
