import type { PrismaClient } from "@prisma/client";

import { outboxJobOptions, queueForEvent, type OutboxJob, type QueueName } from "./queues.js";

const LEASE_MS = 30_000;
const MAX_PUBLISH_ATTEMPTS = 8;

export type OutboxQueue = {
  add(
    name: string,
    data: OutboxJob,
    options: typeof outboxJobOptions & { jobId: string },
  ): Promise<unknown>;
};

export type OutboxQueues = Record<QueueName, OutboxQueue>;

/** Claims committed events with database leases; queue publication is at-least-once. */
export async function claimOutboxBatch(
  db: PrismaClient,
  workerId: string,
  now = new Date(),
  limit = 25,
  onlyEventId?: string,
) {
  if (!workerId || limit < 1 || limit > 100) throw new Error("Invalid outbox claim.");
  if (onlyEventId && !/^[0-9a-f-]{36}$/i.test(onlyEventId))
    throw new Error("Invalid outbox event ID.");
  return db.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "OutboxEvent"
      WHERE state IN ('PENDING', 'RETRY_PENDING')
        AND "availableAt" <= ${now}
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
        AND (${onlyEventId ?? null}::uuid IS NULL OR id = ${onlyEventId ?? null}::uuid)
      ORDER BY "createdAt", id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (claimed.length === 0) return [];
    const ids = claimed.map((event) => event.id);
    await tx.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + LEASE_MS) },
    });
    return tx.outboxEvent.findMany({
      where: { id: { in: ids } },
      select: { id: true, eventType: true, attempts: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
}

export async function publishOutboxBatch(
  db: PrismaClient,
  queues: OutboxQueues,
  workerId: string,
  now = new Date(),
  onlyEventId?: string,
) {
  const events = await claimOutboxBatch(db, workerId, now, 25, onlyEventId);
  let published = 0;
  let retried = 0;
  let deadLettered = 0;
  for (const event of events) {
    try {
      await queues[queueForEvent(event.eventType)].add(
        event.eventType,
        { outboxEventId: event.id },
        { ...outboxJobOptions, jobId: event.id },
      );
      const updated = await db.outboxEvent.updateMany({
        where: { id: event.id, leaseOwner: workerId, state: { in: ["PENDING", "RETRY_PENDING"] } },
        data: {
          state: "PUBLISHED",
          publishedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      published += updated.count;
    } catch {
      const attempts = event.attempts + 1;
      const dead = attempts >= MAX_PUBLISH_ATTEMPTS;
      const updated = await db.outboxEvent.updateMany({
        where: { id: event.id, leaseOwner: workerId, state: { in: ["PENDING", "RETRY_PENDING"] } },
        data: {
          state: dead ? "DEAD_LETTER" : "RETRY_PENDING",
          attempts,
          availableAt: new Date(now.getTime() + Math.min(60_000 * 2 ** attempts, 3_600_000)),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: "QUEUE_UNAVAILABLE",
        },
      });
      if (updated.count) {
        if (dead) deadLettered++;
        else retried++;
      }
    }
  }
  return { claimed: events.length, published, retried, deadLettered };
}
