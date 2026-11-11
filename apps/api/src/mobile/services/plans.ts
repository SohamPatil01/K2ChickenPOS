import { prisma, Prisma } from '@azela-pos/db';
import type { z } from 'zod';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time.js';
import { isValidYmd, nextPlanOccurrence, upcomingPlanDates } from '../domain/weeklyPlan.js';
import type { RequestedLine } from '../domain/quote.js';
import type { weeklyPlanPatchSchema, weeklyPlanSchema } from '../contracts.js';
import { HttpError } from '../errors.js';
import type { IdentityContext } from './identity.js';

type PlanInput = z.infer<typeof weeklyPlanSchema>;
type PlanPatch = z.infer<typeof weeklyPlanPatchSchema>;
type PlanRow = Awaited<ReturnType<typeof prisma.weeklyPlan.findFirstOrThrow>>;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function schedule(plan: Pick<PlanRow, 'dayOfWeek' | 'reminderMinutes' | 'skipDates' | 'status'>) {
  return {
    dayOfWeek: plan.dayOfWeek,
    reminderMinutes: plan.reminderMinutes,
    skipDates: plan.skipDates,
    status: plan.status === 'PAUSED' ? ('PAUSED' as const) : ('ACTIVE' as const),
  };
}

export function serializePlan(plan: PlanRow, now = new Date()) {
  const next = nextPlanOccurrence(schedule(plan), now);
  return {
    id: plan.id,
    name: plan.name,
    storeId: plan.storeId,
    items: plan.itemsJson as unknown as RequestedLine[],
    dayOfWeek: plan.dayOfWeek,
    dayName: DAY_NAMES[plan.dayOfWeek],
    reminderTime: minutesToHhmm(plan.reminderMinutes),
    fulfillment: plan.fulfillment,
    addressId: plan.addressId,
    slotPreference: plan.slotPreference,
    status: plan.status,
    skipDates: plan.skipDates,
    nextPlanDate: next?.forDate ?? null,
    nextReminderAt: next?.remindAt.toISOString() ?? null,
    upcomingDates: upcomingPlanDates(plan, now, 4),
    timezone: 'Asia/Kolkata',
    autoOrder: false,
  };
}

async function assertAddress(ctx: IdentityContext, addressId: string | null | undefined) {
  if (!addressId) return;
  const ok = await prisma.customerAddress.findFirst({ where: { id: addressId, customerId: { in: ctx.customerIds } }, select: { id: true } });
  if (!ok) throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
}

async function own(ctx: IdentityContext, id: string): Promise<PlanRow> {
  const plan = await prisma.weeklyPlan.findFirst({ where: { id, identityId: ctx.identityId, deletedAt: null } });
  if (!plan) throw new HttpError(404, 'NOT_FOUND', 'Plan not found');
  return plan;
}

export async function listPlans(ctx: IdentityContext) {
  const plans = await prisma.weeklyPlan.findMany({ where: { identityId: ctx.identityId, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  return plans.map((p) => serializePlan(p));
}

export async function getPlan(ctx: IdentityContext, id: string) {
  const plan = await own(ctx, id);
  const reminders = await prisma.weeklyPlanReminder.findMany({ where: { planId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
  return {
    ...serializePlan(plan),
    reminders: reminders.map((r) => ({ forDate: r.forDate, status: r.status, reason: r.reason, at: r.scheduledFor.toISOString() })),
  };
}

export async function createPlan(ctx: IdentityContext, input: PlanInput) {
  const count = await prisma.weeklyPlan.count({ where: { identityId: ctx.identityId, deletedAt: null } });
  if (count >= 5) throw new HttpError(409, 'PLAN_LIMIT', 'You can have up to 5 weekly plans');
  await assertAddress(ctx, input.addressId);
  const reminderMinutes = hhmmToMinutes(input.reminderTime) as number;
  const base = { dayOfWeek: input.dayOfWeek, reminderMinutes, skipDates: [] as string[], status: 'ACTIVE' as const };
  const plan = await prisma.weeklyPlan.create({
    data: {
      identityId: ctx.identityId,
      storeId: input.storeId,
      name: input.name,
      itemsJson: input.items as unknown as Prisma.InputJsonValue,
      dayOfWeek: input.dayOfWeek,
      reminderMinutes,
      fulfillment: input.fulfillment,
      addressId: input.addressId ?? null,
      slotPreference: input.slotPreference ?? null,
      nextReminderAt: nextPlanOccurrence(base, new Date())?.remindAt ?? null,
    },
  });
  return serializePlan(plan);
}

export async function updatePlan(ctx: IdentityContext, id: string, patch: PlanPatch) {
  const plan = await own(ctx, id);
  if (patch.addressId !== undefined) await assertAddress(ctx, patch.addressId);
  const merged = {
    dayOfWeek: patch.dayOfWeek ?? plan.dayOfWeek,
    reminderMinutes: patch.reminderTime ? (hhmmToMinutes(patch.reminderTime) as number) : plan.reminderMinutes,
    skipDates: plan.skipDates,
    status: patch.status ?? (plan.status as 'ACTIVE' | 'PAUSED'),
  };
  const updated = await prisma.weeklyPlan.update({
    where: { id },
    data: {
      name: patch.name ?? undefined,
      storeId: patch.storeId ?? undefined,
      itemsJson: patch.items ? (patch.items as unknown as Prisma.InputJsonValue) : undefined,
      dayOfWeek: merged.dayOfWeek,
      reminderMinutes: merged.reminderMinutes,
      fulfillment: patch.fulfillment ?? undefined,
      addressId: patch.addressId === undefined ? undefined : patch.addressId,
      slotPreference: patch.slotPreference === undefined ? undefined : patch.slotPreference,
      status: merged.status,
      nextReminderAt: nextPlanOccurrence(schedule(merged), new Date())?.remindAt ?? null,
    },
  });
  return serializePlan(updated);
}

export async function skipPlanDate(ctx: IdentityContext, id: string, date: string, skip: boolean) {
  const plan = await own(ctx, id);
  if (!isValidYmd(date) || !upcomingPlanDates(plan, new Date(), 8).includes(date)) {
    throw new HttpError(400, 'INVALID_DATE', 'Choose one of the upcoming plan dates');
  }
  const skipDates = skip ? [...new Set([...plan.skipDates, date])].sort() : plan.skipDates.filter((d) => d !== date);
  const updated = await prisma.weeklyPlan.update({
    where: { id },
    data: { skipDates, nextReminderAt: nextPlanOccurrence({ ...schedule(plan), skipDates }, new Date())?.remindAt ?? null },
  });
  return serializePlan(updated);
}

export async function deletePlan(ctx: IdentityContext, id: string) {
  await own(ctx, id);
  await prisma.weeklyPlan.update({ where: { id }, data: { deletedAt: new Date(), status: 'PAUSED', nextReminderAt: null } });
}

export async function planLines(ctx: IdentityContext, id: string) {
  const plan = await own(ctx, id);
  return { storeId: plan.storeId, lines: plan.itemsJson as unknown as RequestedLine[], plan };
}
