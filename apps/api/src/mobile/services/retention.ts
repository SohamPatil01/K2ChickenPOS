import { prisma, Prisma } from '@azela-pos/db';
import { REORDER_REMINDER_EXPERIMENT } from '../domain/experiments.js';

/**
 * Retention KPIs from the POS system of record (PAID sales) plus app tables.
 * Weeks are ISO weeks in Asia/Kolkata. Contribution margin is NOT computed: sales carry no
 * cost-of-goods, so a margin figure would be invented.
 */
export async function retentionDashboard(args: { storeIds: string[] | null; weeks: number }) {
  const weeks = Math.min(26, Math.max(4, args.weeks));
  const storeFilter = args.storeIds ? Prisma.sql`AND s."storeId" IN (${Prisma.join(args.storeIds)})` : Prisma.empty;
  const since = new Date(Date.now() - weeks * 7 * 86_400_000);

  const weekly = await prisma.$queryRaw<
    Array<{ week: Date; orders: number; customers: number; kg: number; revenue: number; appOrders: number }>
  >(Prisma.sql`
    WITH sales AS (
      SELECT s.id, s."customerId", s."grandTotal", date_trunc('week', s."createdAt" AT TIME ZONE 'Asia/Kolkata') AS week
      FROM "Sale" s
      WHERE s.status = 'PAID' AND s."createdAt" >= ${since} ${storeFilter}
    )
    SELECT sales.week,
      COUNT(*)::int AS orders,
      COUNT(DISTINCT sales."customerId")::int AS customers,
      COALESCE(SUM(si.kg), 0)::float AS kg,
      COALESCE(SUM(sales."grandTotal"), 0)::float AS revenue,
      COUNT(DISTINCT po."saleId") FILTER (WHERE po.source = 'MOBILE_APP')::int AS "appOrders"
    FROM sales
    LEFT JOIN (SELECT "saleId", SUM(COALESCE("qtyKg", 0)) AS kg FROM "SaleItem" GROUP BY "saleId") si ON si."saleId" = sales.id
    LEFT JOIN "PreOrder" po ON po."saleId" = sales.id
    GROUP BY sales.week ORDER BY sales.week ASC`);

  const repeat = await prisma.$queryRaw<Array<{ firstTimers: number; secondWithin30: number; activeBase: number; repeat30: number }>>(Prisma.sql`
    WITH paid AS (
      SELECT s."customerId", s."createdAt" FROM "Sale" s
      WHERE s.status = 'PAID' AND s."customerId" IS NOT NULL ${storeFilter}
    ),
    firsts AS (SELECT "customerId", MIN("createdAt") AS first_at FROM paid GROUP BY "customerId"),
    cohort AS (SELECT * FROM firsts WHERE first_at >= ${since} AND first_at < NOW() - INTERVAL '30 days'),
    second AS (
      SELECT c."customerId" FROM cohort c JOIN paid p ON p."customerId" = c."customerId"
      WHERE p."createdAt" > c.first_at + INTERVAL '1 hour' AND p."createdAt" <= c.first_at + INTERVAL '30 days'
      GROUP BY c."customerId"
    ),
    last60 AS (SELECT "customerId", COUNT(*) AS n FROM paid WHERE "createdAt" >= NOW() - INTERVAL '30 days' GROUP BY "customerId")
    SELECT
      (SELECT COUNT(*) FROM cohort)::int AS "firstTimers",
      (SELECT COUNT(*) FROM second)::int AS "secondWithin30",
      (SELECT COUNT(*) FROM last60)::int AS "activeBase",
      (SELECT COUNT(*) FROM last60 WHERE n >= 2)::int AS "repeat30"`);

  const funnelNames = ['reorder_card_viewed', 'reorder_started', 'reorder_quote_created', 'reorder_checkout_started', 'reorder_completed', 'reorder_failed', 'checkout_started', 'checkout_completed'];
  const funnelRows = await prisma.appAnalyticsEvent.groupBy({ by: ['name'], where: { name: { in: funnelNames }, occurredAt: { gte: since } }, _count: { _all: true } });
  const funnel = Object.fromEntries(funnelNames.map((n) => [n, funnelRows.find((r) => r.name === n)?._count._all ?? 0]));

  const app = await prisma.$queryRaw<Array<{ placed: number; cancelled: number; noShow: number; fulfilled: number; reorderPlaced: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS placed,
      COUNT(*) FILTER (WHERE po.status = 'CANCELLED')::int AS cancelled,
      COUNT(*) FILTER (WHERE po.status = 'NO_SHOW')::int AS "noShow",
      COUNT(*) FILTER (WHERE po.status = 'FULFILLED')::int AS fulfilled,
      COUNT(*) FILTER (WHERE mo.source = 'REORDER')::int AS "reorderPlaced"
    FROM "MobileOrder" mo JOIN "PreOrder" po ON po.id = mo."preOrderId"
    WHERE mo."createdAt" >= ${since}`);

  const loyalty = await prisma.$queryRaw<Array<{ earners: number; redeemedPoints: number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT lt."customerId") FILTER (WHERE lt.type = 'EARN')::int AS earners,
      COALESCE(-SUM(lt.points) FILTER (WHERE lt.type = 'REDEEM'), 0)::float AS "redeemedPoints"
    FROM "LoyaltyTransaction" lt WHERE lt."createdAt" >= ${since}`);

  const notif = await prisma.notificationLog.groupBy({ by: ['kind', 'channel', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true } });
  const consentChanges = await prisma.communicationConsent.groupBy({ by: ['channel', 'purpose', 'granted'], where: { createdAt: { gte: since } }, _count: { _all: true } });

  // Holdout vs treatment: share of assigned identities with an app order in the window.
  const experiment = await prisma.$queryRaw<Array<{ variant: string; assigned: number; ordered: number }>>(Prisma.sql`
    SELECT ea.variant, COUNT(*)::int AS assigned,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "MobileOrder" mo WHERE mo."identityId" = ea."identityId" AND mo."createdAt" > ea."assignedAt"))::int AS ordered
    FROM "ExperimentAssignment" ea WHERE ea."experimentKey" = ${REORDER_REMINDER_EXPERIMENT}
    GROUP BY ea.variant`);

  const r = repeat[0];
  const totalOrders = weekly.reduce((s, w) => s + w.orders, 0);
  const totalKg = weekly.reduce((s, w) => s + w.kg, 0);
  const totalRevenue = weekly.reduce((s, w) => s + w.revenue, 0);
  const a = app[0];
  return {
    windowWeeks: weeks,
    timezone: 'Asia/Kolkata',
    weekly: weekly.map((w) => ({
      weekStart: w.week.toISOString().slice(0, 10),
      purchasingCustomers: w.customers,
      orders: w.orders,
      kg: Math.round(w.kg * 10) / 10,
      revenuePaise: Math.round(w.revenue * 100),
      ordersPerCustomer: w.customers ? Math.round((w.orders / w.customers) * 100) / 100 : null,
      appOrders: w.appOrders,
    })),
    totals: {
      orders: totalOrders,
      kg: Math.round(totalKg * 10) / 10,
      avgKgPerOrder: totalOrders ? Math.round((totalKg / totalOrders) * 100) / 100 : null,
      avgBasketPaise: totalOrders ? Math.round((totalRevenue / totalOrders) * 100) : null,
      contributionMargin: null,
      contributionMarginNote: 'Not available: POS sales do not record cost of goods.',
    },
    repeat: {
      firstTimeCustomers: r.firstTimers,
      convertedToSecondWithin30Days: r.secondWithin30,
      firstToSecondRate: r.firstTimers ? Math.round((r.secondWithin30 / r.firstTimers) * 1000) / 10 : null,
      activeLast30Days: r.activeBase,
      repeatPurchaseRate30d: r.activeBase ? Math.round((r.repeat30 / r.activeBase) * 1000) / 10 : null,
    },
    appOrders: {
      placed: a.placed,
      fulfilled: a.fulfilled,
      cancelled: a.cancelled,
      noShow: a.noShow,
      cancellationRate: a.placed ? Math.round((a.cancelled / a.placed) * 1000) / 10 : null,
      reorderPlaced: a.reorderPlaced,
    },
    reorderFunnel: funnel,
    loyalty: {
      earningCustomers: loyalty[0].earners,
      redeemedPoints: Math.round(loyalty[0].redeemedPoints),
    },
    notifications: notif.map((n) => ({ kind: n.kind, channel: n.channel, status: n.status, count: n._count._all })),
    consentChanges: consentChanges.map((c) => ({ channel: c.channel, purpose: c.purpose, granted: c.granted, count: c._count._all })),
    experiment: {
      key: REORDER_REMINDER_EXPERIMENT,
      variants: experiment,
      note: 'Compare order rates between HOLDOUT and TREATMENT before attributing any lift to reminders.',
    },
  };
}

export async function syncHealth() {
  const [outbox, dead, holdsStuck, notifFailures, cursors, deletionRequests] = await Promise.all([
    prisma.outboxEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.outboxEvent.findMany({ where: { status: 'DEAD' }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, type: true, aggregateId: true, lastError: true, attempts: true, createdAt: true } }),
    prisma.$queryRaw<Array<{ id: string; preOrderId: string; points: number; status: string }>>`
      SELECT mo.id, mo."preOrderId", mo."loyaltyPointsHeld" AS points, po.status::text AS status
      FROM "MobileOrder" mo JOIN "PreOrder" po ON po.id = mo."preOrderId"
      WHERE mo."loyaltyHoldStatus" = 'HELD' AND po.status = 'FULFILLED' AND po."saleId" IS NULL LIMIT 50`,
    prisma.notificationLog.findMany({ where: { status: { in: ['FAILED', 'PROVIDER_NOT_CONFIGURED'] } }, orderBy: { createdAt: 'desc' }, take: 20, select: { kind: true, channel: true, status: true, reason: true, createdAt: true } }),
    prisma.integrationCursor.findMany(),
    prisma.dataRightsRequest.findMany({ where: { status: 'REQUESTED' }, orderBy: { createdAt: 'asc' }, take: 50 }),
  ]);
  return {
    outbox: Object.fromEntries(outbox.map((o) => [o.status, o._count._all])),
    deadEvents: dead,
    fulfilledWithoutLinkedSale: holdsStuck,
    fulfilledWithoutLinkedSaleNote: 'Pre-orders marked FULFILLED without a linked sale keep loyalty points on hold. Bill them via "load into cart" so the sale links.',
    recentNotificationProblems: notifFailures,
    cursors: cursors.map((c) => ({ name: c.name, at: c.cursorAt.toISOString(), lagSeconds: Math.round((Date.now() - c.cursorAt.getTime()) / 1000) })),
    openDataRightsRequests: deletionRequests,
  };
}
