import { prisma, Prisma } from '@azela-pos/db';
import { formatInr } from '../domain/money.js';
import { isReorderReminderDue } from '../domain/prediction.js';
import { istParts } from '../domain/time.js';
import { nextPlanOccurrence } from '../domain/weeklyPlan.js';
import { getRewardsConfig } from '../domain/rewards.js';
import { claimOutbox, completeOutbox, failOutbox } from '../services/outbox.js';
import { deliverNotification, enqueueNotification, type NotificationPayload } from '../services/notifications.js';
import { maybeSendWhatsApp } from '../services/whatsapp.js';
import { reconcileLoyaltyHolds } from '../services/loyalty.js';
import { computeAndStorePrediction, identitiesNeedingPrediction } from '../services/personalization.js';
import { loadIdentity } from '../services/identity.js';
import { lastReorderable } from '../services/orders.js';

/** Inbox cursor. First run starts "now" — we never blast customers with historical events. */
async function readCursor(name: string, now: Date) {
  const c = await prisma.integrationCursor.findUnique({ where: { name } });
  if (c) return c;
  return prisma.integrationCursor.create({ data: { name, cursorAt: now, cursorId: '' } });
}
async function writeCursor(name: string, at: Date, id: string) {
  await prisma.integrationCursor.update({ where: { name }, data: { cursorAt: at, cursorId: id } });
}
function afterCursor(c: { cursorAt: Date; cursorId: string | null }) {
  return {
    OR: [{ createdAt: { gt: c.cursorAt } }, { createdAt: c.cursorAt, id: { gt: c.cursorId ?? '' } }],
  };
}

const STATUS_PUSH: Record<string, { title: string; body: (store: string) => string }> = {
  CONFIRMED: { title: 'Order accepted', body: (s) => `${s} has accepted your order and is preparing it.` },
  READY: { title: 'Your order is ready', body: (s) => `Your chicken is ready at ${s}.` },
  FULFILLED: { title: 'Order complete', body: () => 'Thanks for ordering with K2 Chicken!' },
  CANCELLED: { title: 'Order cancelled', body: () => 'Your order was cancelled. Open the app for details.' },
  NO_SHOW: { title: 'Order not collected', body: () => 'We could not hand over your order. Please contact the store.' },
};

export async function ingestPreOrderEvents(now: Date, limit = 500): Promise<number> {
  const name = 'preorder-events-v1';
  const cursor = await readCursor(name, now);
  const events = await prisma.preOrderEvent.findMany({
    where: { ...afterCursor(cursor), visibleToCustomer: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    include: { preOrder: { select: { id: true, fulfillment: true, store: { select: { name: true } } } } },
  });
  if (!events.length) return 0;
  const mobile = new Map(
    (await prisma.mobileOrder.findMany({ where: { preOrderId: { in: [...new Set(events.map((e) => e.preOrderId))] } } })).map((m) => [m.preOrderId, m])
  );
  let queued = 0;
  for (const e of events) {
    const mo = mobile.get(e.preOrderId);
    if (!mo) continue;
    const store = e.preOrder.store?.name ?? 'K2 Chicken';
    let n: NotificationPayload | null = null;
    if (e.kind === 'STATUS' && e.status && STATUS_PUSH[e.status]) {
      // Customer-initiated cancellation needs no push back to the same customer.
      if (e.status === 'CANCELLED' && e.message.startsWith('Cancelled by customer')) continue;
      const t = STATUS_PUSH[e.status];
      n = { identityId: mo.identityId, kind: 'ORDER_STATUS', title: t.title, body: t.body(store), deepLink: `/order/po_${e.preOrderId}` };
    } else if (e.kind === 'MESSAGE') {
      n = { identityId: mo.identityId, kind: 'ORDER_STATUS', title: `Message from ${store}`, body: e.message.slice(0, 160), deepLink: `/order/po_${e.preOrderId}` };
    }
    if (n && (await enqueueNotification(prisma, `preorder-event:${e.id}`, n))) queued++;
  }
  const last = events[events.length - 1];
  await writeCursor(name, last.createdAt, last.id);
  return queued;
}

export async function ingestDeliveryEvents(now: Date, limit = 500): Promise<number> {
  const name = 'delivery-events-v1';
  const cursor = await readCursor(name, now);
  const events = await prisma.deliveryEvent.findMany({
    where: { ...afterCursor(cursor), status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    include: { deliveryOrder: { select: { saleId: true } } },
  });
  if (!events.length) return 0;
  let queued = 0;
  for (const e of events) {
    const po = await prisma.preOrder.findFirst({ where: { saleId: e.deliveryOrder.saleId }, select: { id: true } });
    const mo = po ? await prisma.mobileOrder.findUnique({ where: { preOrderId: po.id } }) : null;
    if (!po || !mo) continue;
    const out = e.status === 'OUT_FOR_DELIVERY';
    if (
      await enqueueNotification(prisma, `delivery-event:${e.id}`, {
        identityId: mo.identityId,
        kind: 'ORDER_STATUS',
        title: out ? 'Out for delivery' : 'Delivered',
        body: out ? 'Your K2 Chicken order is on the way.' : 'Your order has been delivered. Enjoy!',
        deepLink: `/order/po_${po.id}`,
      })
    )
      queued++;
  }
  const last = events[events.length - 1];
  await writeCursor(name, last.createdAt, last.id);
  return queued;
}

/** Reward pushes from the POS loyalty ledger + optional configurable milestone bonus. */
export async function ingestLoyalty(now: Date, limit = 500): Promise<number> {
  const name = 'loyalty-txns-v1';
  const cursor = await readCursor(name, now);
  const txns = await prisma.loyaltyTransaction.findMany({
    where: { ...afterCursor(cursor), type: { in: ['EARN', 'REFERRAL', 'MILESTONE'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  if (!txns.length) return 0;
  const links = new Map(
    (await prisma.customerIdentityLink.findMany({ where: { customerId: { in: [...new Set(txns.map((t) => t.customerId))] } } })).map((l) => [
      l.customerId,
      l.identityId,
    ])
  );
  const cfg = getRewardsConfig();
  let queued = 0;
  for (const t of txns) {
    const identityId = links.get(t.customerId);
    if (!identityId || t.points <= 0) continue;
    const label = t.type === 'REFERRAL' ? 'Referral bonus' : t.type === 'MILESTONE' ? 'Milestone reward' : 'Points earned';
    if (
      await enqueueNotification(prisma, `loyalty-txn:${t.id}`, {
        identityId,
        kind: 'REWARD',
        title: `${label}: +${Math.round(t.points)} points`,
        body: `Your K2 Rewards balance is now ${Math.round(t.balance)} points.`,
        deepLink: '/rewards',
      })
    )
      queued++;
    if (t.type === 'EARN' && t.saleId && cfg.milestoneEveryOrders > 0 && cfg.milestoneBonusPoints > 0) {
      await maybeCreditMilestone(t.customerId, t.storeId, t.saleId, cfg.milestoneEveryOrders, cfg.milestoneBonusPoints);
    }
  }
  const last = txns[txns.length - 1];
  await writeCursor(name, last.createdAt, last.id);
  return queued;
}

async function maybeCreditMilestone(customerId: string, storeId: string, saleId: string, every: number, bonus: number) {
  await prisma.$transaction(async (tx) => {
    const exists = await tx.loyaltyTransaction.findFirst({ where: { saleId, type: 'MILESTONE' }, select: { id: true } });
    if (exists) return;
    const earnCount = await tx.loyaltyTransaction.count({ where: { customerId, type: 'EARN' } });
    if (earnCount === 0 || earnCount % every !== 0) return;
    const rows = await tx.$queryRaw<Array<{ loyaltyPoints: number }>>`SELECT "loyaltyPoints" FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
    const balance = (rows[0]?.loyaltyPoints || 0) + bonus;
    await tx.customer.update({ where: { id: customerId }, data: { loyaltyPoints: balance } });
    await tx.loyaltyTransaction.create({
      data: { customerId, storeId, type: 'MILESTONE', points: bonus, balance, description: `Milestone bonus (+${bonus}) — ${earnCount} paid orders`, saleId },
    });
  });
}

export async function runPlanReminders(now: Date, limit = 200): Promise<number> {
  const due = await prisma.weeklyPlan.findMany({
    where: { status: 'ACTIVE', deletedAt: null, nextReminderAt: { lte: now } },
    take: limit,
    orderBy: { nextReminderAt: 'asc' },
  });
  let queued = 0;
  for (const plan of due) {
    const remindAt = plan.nextReminderAt as Date;
    const occ = nextPlanOccurrence(
      { dayOfWeek: plan.dayOfWeek, reminderMinutes: plan.reminderMinutes, skipDates: plan.skipDates, status: 'ACTIVE' },
      new Date(remindAt.getTime() - 1)
    );
    const forDate = occ?.forDate ?? istParts(remindAt).ymd;
    const recentOrder = await prisma.mobileOrder.findFirst({
      where: { identityId: plan.identityId, createdAt: { gte: new Date(remindAt.getTime() - 3 * 86_400_000) } },
      select: { id: true },
    });
    const stale = now.getTime() - remindAt.getTime() > 6 * 3600_000; // missed by >6h (worker downtime) — don't send late
    const status = recentOrder ? 'SUPPRESSED' : stale ? 'SKIPPED' : 'QUEUED';
    const created = await prisma.weeklyPlanReminder.createMany({
      data: [
        {
          planId: plan.id,
          forDate,
          scheduledFor: remindAt,
          status,
          reason: recentOrder ? 'ALREADY_ORDERED' : stale ? 'MISSED_WINDOW' : null,
        },
      ],
      skipDuplicates: true,
    });
    if (created.count === 1 && status === 'QUEUED') {
      await enqueueNotification(prisma, `plan:${plan.id}:${forDate}`, {
        identityId: plan.identityId,
        kind: 'PLAN_REMINDER',
        title: `Time for your ${plan.name}`,
        body: 'Tap to review today’s prices and confirm. Nothing is ordered until you confirm.',
        deepLink: `/weekly-plans/${plan.id}?date=${forDate}`,
      });
      queued++;
    }
    await prisma.weeklyPlan.update({
      where: { id: plan.id },
      data: {
        lastReminderAt: remindAt,
        nextReminderAt:
          nextPlanOccurrence(
            { dayOfWeek: plan.dayOfWeek, reminderMinutes: plan.reminderMinutes, skipDates: plan.skipDates, status: 'ACTIVE' },
            now
          )?.remindAt ?? null,
      },
    });
  }
  return queued;
}

export async function runPredictions(now: Date, limit = 100): Promise<{ computed: number; reminders: number }> {
  const ids = await identitiesNeedingPrediction(limit, new Date(now.getTime() - 20 * 3600_000));
  let reminders = 0;
  for (const identityId of ids) {
    const p = await computeAndStorePrediction(identityId, now);
    if (!isReorderReminderDue(p, now) || !p.nextExpectedAt) continue;
    // Suppress if they already ordered through the app since their last completed purchase.
    const since = p.lastPurchaseAt ?? new Date(0);
    const ordered = await prisma.mobileOrder.findFirst({ where: { identityId, createdAt: { gt: since } }, select: { id: true } });
    if (ordered) continue;
    const ctx = await loadIdentity(identityId).catch(() => null);
    const last = ctx ? await lastReorderable(ctx) : null;
    if (!last) continue;
    const ymd = istParts(p.nextExpectedAt).ymd;
    if (
      await enqueueNotification(prisma, `reorder:${identityId}:${ymd}`, {
        identityId,
        kind: 'REORDER_REMINDER',
        title: 'Time for fresh chicken?',
        body: `Reorder your usual (${last.itemsPreview}) in two taps. Prices refresh before you confirm.`,
        deepLink: `/reorder/${last.id}`,
        campaignKey: 'reorder-reminders-v1',
      })
    )
      reminders++;
  }
  return { computed: ids.length, reminders };
}

const ORDER_PLACED_TITLE = 'Order placed';

export async function dispatchOutbox(now: Date, limit = 50) {
  const events = await claimOutbox(limit);
  const stats = { processed: 0, failed: 0 };
  for (const e of events) {
    try {
      if (e.type === 'notification.requested') {
        const p = e.payload as unknown as NotificationPayload & { dedupeKey: string };
        await deliverNotification(p, now);
        await maybeSendWhatsApp(p, now);
      } else if (e.type === 'order.placed') {
        const p = e.payload as { identityId: string; preOrderId: string; totalPaise: number };
        await enqueueNotification(prisma, `order-placed:${p.preOrderId}`, {
          identityId: p.identityId,
          kind: 'ORDER_STATUS',
          title: ORDER_PLACED_TITLE,
          body: `We received your order (est. ${formatInr(p.totalPaise)}). You'll get an update when the store accepts it.`,
          deepLink: `/order/po_${p.preOrderId}`,
        });
      }
      await completeOutbox(e.id);
      stats.processed++;
    } catch (err) {
      await failOutbox(e.id, e.attempts, (err as Error).message || 'error');
      stats.failed++;
    }
  }
  return stats;
}

/** One idempotent scheduler pass. Safe to run every minute from cron; overlapping runs are OK. */
export async function runMobileTick(now = new Date()) {
  const started = Date.now();
  const result = {
    orderEvents: await ingestPreOrderEvents(now),
    deliveryEvents: await ingestDeliveryEvents(now),
    rewards: await ingestLoyalty(now),
    holds: await reconcileLoyaltyHolds(),
    planReminders: await runPlanReminders(now),
    predictions: await runPredictions(now),
    outbox: await dispatchOutbox(now),
    // Second dispatch picks up notifications enqueued by order.placed in the same tick.
    outbox2: await dispatchOutbox(now),
    durationMs: 0,
  };
  result.durationMs = Date.now() - started;
  return result;
}

export type TickResult = Awaited<ReturnType<typeof runMobileTick>>;
export type { Prisma };
