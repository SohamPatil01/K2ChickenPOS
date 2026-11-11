import { prisma, Prisma } from '@azela-pos/db';
import { kgToGrams } from '../domain/money.js';
import { medianIntervalPredictor, type Prediction, type Purchase, type ReorderPredictor } from '../domain/prediction.js';
import { linkedCustomerIds } from './identity.js';

/** Completed POS purchases (PAID sales) for an identity — the system of record for "bought". */
export async function purchasesFor(identityId: string): Promise<Purchase[]> {
  const ids = await linkedCustomerIds(identityId);
  if (!ids.length) return [];
  const sales = await prisma.sale.findMany({
    where: { customerId: { in: ids }, status: 'PAID' },
    select: { createdAt: true, items: { select: { productId: true, qtyKg: true } } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return sales.map((s) => ({
    at: s.createdAt,
    grams: s.items.reduce((g, i) => g + kgToGrams(i.qtyKg), 0),
    productIds: s.items.map((i) => i.productId),
  }));
}

export async function computeAndStorePrediction(
  identityId: string,
  now = new Date(),
  predictor: ReorderPredictor = medianIntervalPredictor
): Promise<Prediction> {
  const p = predictor.predict(await purchasesFor(identityId), now);
  const data = {
    ruleVersion: p.ruleVersion,
    computedAt: now,
    eligible: p.eligible,
    rationale: p.rationale.slice(0, 300),
    purchaseCount: p.purchaseCount,
    medianIntervalDays: p.medianIntervalDays,
    usualWeekday: p.usualWeekday,
    avgOrderGrams: p.avgOrderGrams,
    lastPurchaseAt: p.lastPurchaseAt,
    nextExpectedAt: p.nextExpectedAt,
    preferredProductIds: p.preferredProductIds,
    confidence: p.confidence,
  };
  await prisma.reorderPrediction.upsert({ where: { identityId }, create: { identityId, ...data }, update: data });
  return p;
}

/** Home-screen recommendations: preferred products that are currently sellable at the store. */
export async function recommendations(identityId: string, catalogProductIds: Set<string>) {
  const pred = await prisma.reorderPrediction.findUnique({ where: { identityId } });
  const preferred = (pred?.preferredProductIds ?? []).filter((id) => catalogProductIds.has(id));
  return {
    productIds: preferred,
    usualWeekday: pred?.usualWeekday ?? null,
    nextExpectedAt: pred?.nextExpectedAt?.toISOString() ?? null,
    basis: pred ? `${pred.ruleVersion}: ${pred.rationale}` : 'Not enough purchase history yet',
  };
}

export async function identitiesNeedingPrediction(limit: number, staleBefore: Date): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT ci.id FROM "CustomerIdentity" ci
    LEFT JOIN "ReorderPrediction" rp ON rp."identityId" = ci.id
    WHERE ci."deletionRequestedAt" IS NULL AND (rp.id IS NULL OR rp."computedAt" < ${staleBefore})
    ORDER BY rp."computedAt" ASC NULLS FIRST
    LIMIT ${limit}`);
  return rows.map((r) => r.id);
}
