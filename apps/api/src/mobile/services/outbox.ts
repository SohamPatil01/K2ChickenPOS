import { prisma, Prisma } from '@azela-pos/db';

type Tx = Prisma.TransactionClient;

export type OutboxInput = {
  type: string;
  version?: number;
  aggregateType: string;
  aggregateId: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
};

/** Insert-once (dedupeKey). Safe to call repeatedly for the same business event. */
export async function enqueueOutbox(db: Tx | typeof prisma, e: OutboxInput): Promise<boolean> {
  const res = await db.outboxEvent.createMany({
    data: [
      {
        type: e.type,
        version: e.version ?? 1,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        dedupeKey: e.dedupeKey,
        payload: e.payload as Prisma.InputJsonValue,
        availableAt: e.availableAt ?? new Date(),
      },
    ],
    skipDuplicates: true,
  });
  return res.count === 1;
}

export type ClaimedEvent = {
  id: string;
  type: string;
  version: number;
  aggregateId: string;
  payload: Record<string, unknown>;
  attempts: number;
};

/** Claim a batch with SKIP LOCKED so parallel workers never double-process. */
export async function claimOutbox(limit = 50): Promise<ClaimedEvent[]> {
  return prisma.$queryRaw<ClaimedEvent[]>`
    UPDATE "OutboxEvent" SET status = 'PROCESSING', attempts = attempts + 1, "availableAt" = NOW()
    WHERE id IN (
      SELECT id FROM "OutboxEvent"
      WHERE (status = 'PENDING' OR (status = 'PROCESSING' AND "availableAt" < NOW() - INTERVAL '10 minutes'))
        AND "availableAt" <= NOW()
      ORDER BY "availableAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, version, "aggregateId", payload, attempts`;
}

export async function completeOutbox(id: string) {
  await prisma.outboxEvent.update({ where: { id }, data: { status: 'DONE', processedAt: new Date(), lastError: null } });
}

export async function failOutbox(id: string, attempts: number, error: string) {
  const dead = attempts >= 5;
  await prisma.outboxEvent.update({
    where: { id },
    data: {
      status: dead ? 'DEAD' : 'PENDING',
      lastError: error.slice(0, 500),
      availableAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** attempts) * 1000),
    },
  });
}
