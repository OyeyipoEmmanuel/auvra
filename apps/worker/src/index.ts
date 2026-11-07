import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Worker } from "bullmq";
import { config } from "dotenv";

import { handleOutboxJob } from "./orchestration/event-handler.js";
import { parkExpiredExternalActions } from "./orchestration/external-actions.js";
import {
  createQueues,
  queueNames,
  redisConnection,
  type OutboxJob,
} from "./orchestration/queues.js";
import { publishOutboxBatch } from "./orchestration/outbox-publisher.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });

async function main() {
  if (process.env.AUVRA_M7_ENABLED !== "true") {
    console.log("M7 worker is disabled; set AUVRA_M7_ENABLED=true only for local validation.");
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error("DATABASE_URL and REDIS_URL are required.");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const queues = createQueues(redisUrl);
  const workers = queueNames.map((name) => {
    const worker = new Worker<OutboxJob>(
      `auvra-${name}`,
      (job) => handleOutboxJob(db, name, job.name, job.data),
      { connection: redisConnection(redisUrl), concurrency: name === "procurement" ? 2 : 1 },
    );
    worker.on("error", () => console.error(`${name} queue connection error.`));
    worker.on("failed", (job) => console.error(`${name} job failed: ${job?.id ?? "unknown"}`));
    return worker;
  });

  const workerId = randomUUID();
  let stopping = false;
  const poll = async () => {
    while (!stopping) {
      try {
        const parked = await parkExpiredExternalActions(db);
        if (parked > 0) console.warn(`External actions awaiting reconciliation: ${parked}`);
        const result = await publishOutboxBatch(db, queues, workerId);
        if (result.claimed > 0) console.log(`Outbox publish: ${JSON.stringify(result)}`);
      } catch {
        console.error("Outbox publisher unavailable; retrying.");
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  };

  let polling: Promise<void>;
  const shutdown = async () => {
    stopping = true;
    await polling;
    await Promise.all(workers.map((worker) => worker.close()));
    await Promise.all(Object.values(queues).map((queue) => queue.close()));
    await db.$disconnect();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  console.log("M7 local worker started. Supplier hiring remains disabled.");
  polling = poll();
  await polling;
}

await main();
