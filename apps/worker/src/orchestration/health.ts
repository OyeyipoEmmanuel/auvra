import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { createQueues } from "./queues.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  throw new Error("DATABASE_URL and REDIS_URL are required.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const queues = createQueues(process.env.REDIS_URL);
try {
  const [buyerConnection, outbox, externalActions, staleLeases, queueCounts] = await Promise.all([
    db.marketplaceBuyerConnection.findUnique({
      where: { id: "primary" },
      select: { accountId: true, connectedAt: true, lastVerifiedAt: true },
    }),
    db.outboxEvent.groupBy({ by: ["state"], _count: { _all: true } }),
    db.externalAction.groupBy({ by: ["state"], _count: { _all: true } }),
    db.outboxEvent.count({
      where: { leaseExpiresAt: { lt: new Date() }, state: { in: ["PENDING", "RETRY_PENDING"] } },
    }),
    Promise.all(
      Object.entries(queues).map(
        async ([name, queue]) => [name, await queue.getJobCounts()] as const,
      ),
    ),
  ]);
  console.log(
    JSON.stringify(
      {
        buyerConnection: buyerConnection
          ? { connected: Boolean(buyerConnection.accountId), ...buyerConnection }
          : { connected: false },
        outbox: Object.fromEntries(outbox.map((entry) => [entry.state, entry._count._all])),
        staleLeases,
        externalActions: Object.fromEntries(
          externalActions.map((entry) => [entry.state, entry._count._all]),
        ),
        queues: Object.fromEntries(queueCounts),
      },
      null,
      2,
    ),
  );
} finally {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
  await db.$disconnect();
}
