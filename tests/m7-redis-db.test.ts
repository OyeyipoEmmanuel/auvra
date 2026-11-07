import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { QueueEvents, Worker } from "bullmq";

import { handleOutboxJob } from "../apps/worker/src/orchestration/event-handler";
import { publishOutboxBatch } from "../apps/worker/src/orchestration/outbox-publisher";
import { createQueues, redisConnection } from "../apps/worker/src/orchestration/queues";

const enabled = process.env.AUVRA_M7_INTEGRATION_TEST === "1";
const db = enabled
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://auvra:auvra_local@localhost:55432/auvra?schema=public",
      }),
    })
  : null;

afterAll(async () => db?.$disconnect());

describe.skipIf(!enabled)("M7 local Redis and PostgreSQL publication", () => {
  it("processes a committed event once across a real Redis worker restart", async () => {
    if (!db) throw new Error("Local database required.");
    const redisUrl = "redis://127.0.0.1:6379";
    const queues = createQueues(redisUrl);
    const events = new QueueEvents("auvra-analysis", { connection: redisConnection(redisUrl) });
    const event = await db.outboxEvent.create({
      data: {
        aggregateType: "ServiceRequest",
        aggregateId: crypto.randomUUID(),
        eventType: "request.submitted",
        idempotencyKey: `m7-restart:${crypto.randomUUID()}`,
        payloadJson: {},
      },
    });
    const startWorker = () =>
      new Worker("auvra-analysis", (job) => handleOutboxJob(db, "analysis", job.name, job.data), {
        connection: redisConnection(redisUrl),
      });
    let worker: Worker | undefined;
    try {
      await events.waitUntilReady();
      worker = startWorker();
      await publishOutboxBatch(db, queues, "m7-restart-worker", new Date(), event.id);
      const first = await queues.analysis.getJob(event.id);
      expect(first).not.toBeNull();
      expect(await first!.waitUntilFinished(events, 5_000)).toEqual({ kind: "OBSERVED" });
      await worker.close();
      worker = undefined;
      await first!.remove();

      const replay = await queues.analysis.add(
        event.eventType,
        { outboxEventId: event.id },
        { jobId: event.id },
      );
      worker = startWorker();
      expect(await replay.waitUntilFinished(events, 5_000)).toEqual({ kind: "REPLAY" });
      expect(
        await db.idempotencyRecord.count({
          where: { scope: "M7_COMMITTED_EVENT", idempotencyKey: event.id },
        }),
      ).toBe(1);
      await replay.remove();
    } finally {
      await worker?.close();
      await events.close();
      await db.idempotencyRecord.deleteMany({
        where: { scope: "M7_COMMITTED_EVENT", idempotencyKey: event.id },
      });
      await db.outboxEvent.delete({ where: { id: event.id } });
      await Promise.all(Object.values(queues).map((queue) => queue.close()));
    }
  });

  it("enqueues a committed event with one stable job ID", async () => {
    if (!db) throw new Error("Local database required.");
    const queues = createQueues("redis://127.0.0.1:6379");
    const event = await db.outboxEvent.create({
      data: {
        aggregateType: "M7Fixture",
        aggregateId: crypto.randomUUID(),
        eventType: "project.created_with_demo_funding",
        idempotencyKey: `m7-redis-fixture:${crypto.randomUUID()}`,
        payloadJson: {},
      },
    });
    try {
      const result = await publishOutboxBatch(
        db,
        queues,
        "redis-fixture-worker",
        new Date(),
        event.id,
      );
      expect(result).toEqual({ claimed: 1, published: 1, retried: 0, deadLettered: 0 });
      const job = await queues.procurement.getJob(event.id);
      expect(job?.data).toEqual({ outboxEventId: event.id });
      expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).state).toBe(
        "PUBLISHED",
      );
      await job?.remove();
    } finally {
      await db.outboxEvent.delete({ where: { id: event.id } });
      await Promise.all(Object.values(queues).map((queue) => queue.close()));
    }
  });
});
