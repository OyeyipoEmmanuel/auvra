import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Worker } from "bullmq";
import { config } from "dotenv";

import { observeBuyerJob } from "./marketplace/observe-buyer-job.js";
import { startHealthServer } from "./health-server.js";
import { handleOutboxJob } from "./orchestration/event-handler.js";
import { parkExpiredExternalActions } from "./orchestration/external-actions.js";
import {
  createQueues,
  queueNames,
  redisConnection,
  type OutboxJob,
} from "./orchestration/queues.js";
import { publishOutboxBatch } from "./orchestration/outbox-publisher.js";
import { processTestnetProjectReceipts } from "./receipts/process-testnet-project-receipts.js";

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
  const server = await startHealthServer();

  const workerId = randomUUID();
  let stopping = false;
  let nextBuyerObservationAt = 0;
  let nextReceiptCheckAt = 0;
  const poll = async () => {
    while (!stopping) {
      try {
        const parked = await parkExpiredExternalActions(db);
        if (parked > 0) console.warn(`External actions awaiting reconciliation: ${parked}`);
        const result = await publishOutboxBatch(db, queues, workerId);
        if (result.claimed > 0) console.log(`Outbox publish: ${JSON.stringify(result)}`);
        if (
          process.env.AUVRA_TESTNET_RECEIPTS_ENABLED === "true" &&
          Date.now() >= nextReceiptCheckAt
        ) {
          nextReceiptCheckAt = Date.now() + 30_000;
          try {
            await processTestnetProjectReceipts(db);
          } catch {
            console.error("NEAR testnet receipt processing failed; retrying later.");
          }
        }
        if (
          process.env.AUVRA_RUNTIME_MODE === "LIVE_MARKET" &&
          process.env.AUVRA_M8_AUTOMATION_ENABLED === "true" &&
          Date.now() >= nextBuyerObservationAt
        ) {
          nextBuyerObservationAt = Date.now() + 30_000;
          const jobs = await db.supplierJob.findMany({
            where: {
              provider: "NEAR_AGENT_MARKET",
              state: { in: ["CREATE_PENDING", "HIRED", "ACTIVE", "SUBMITTED"] },
              OR: [
                { lastObservedAt: null },
                { lastObservedAt: { lte: new Date(Date.now() - 30_000) } },
              ],
            },
            orderBy: { lastObservedAt: "asc" },
            take: 10,
            select: { id: true },
          });
          for (const job of jobs) {
            try {
              await observeBuyerJob(db, job.id);
            } catch {
              console.error(`Marketplace job observation failed: ${job.id}`);
            }
          }
        }
      } catch {
        console.error("Outbox publisher unavailable; retrying.");
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  };

  let polling: Promise<void>;
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = () => {
    shutdownPromise ??= (async () => {
      stopping = true;
      await polling;
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(Object.values(queues).map((queue) => queue.close()));
      await db.$disconnect();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    })();
    return shutdownPromise;
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  console.log(
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED === "true"
      ? "Auvra worker started with policy-gated direct marketplace hiring enabled."
      : "Auvra worker started with direct marketplace hiring disabled.",
  );
  polling = poll();
  await polling;
}

await main();
