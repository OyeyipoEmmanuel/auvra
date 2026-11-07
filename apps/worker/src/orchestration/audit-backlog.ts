import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { queueForEvent } from "./queues.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const events = await db.outboxEvent.findMany({
    where: { state: { in: ["PENDING", "RETRY_PENDING"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      aggregateType: true,
      aggregateId: true,
      eventType: true,
      state: true,
      attempts: true,
      createdAt: true,
      lastError: true,
    },
  });

  const counts = new Map<string, number>();
  for (const event of events) {
    const key = `${event.eventType}:${event.state}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log(
    JSON.stringify(
      {
        total: events.length,
        byTypeAndState: Object.fromEntries(counts),
        events: events.map((event) => ({
          ...event,
          queue: queueForEvent(event.eventType),
          // Raw payloads and provider errors can contain customer data or secrets.
          lastError: event.lastError ? "present" : null,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
