import { Queue, type JobsOptions } from "bullmq";

export const queueNames = [
  "analysis",
  "matching",
  "quoting",
  "procurement",
  "monitoring",
  "qa",
  "delivery",
  "notification",
  "reconciliation",
] as const;

export type QueueName = (typeof queueNames)[number];

/** Routing is deterministic; paid procurement is not performed by this publisher. */
export function queueForEvent(eventType: string): QueueName {
  if (eventType.startsWith("request.")) return "analysis";
  if (eventType.startsWith("supplier.discovery_")) return "matching";
  if (eventType.startsWith("quote.")) return "quoting";
  if (
    eventType.startsWith("project.created_") ||
    eventType === "project.task_ready" ||
    eventType === "project.task_completed"
  )
    return "procurement";
  if (eventType.startsWith("supplier.job_")) return "monitoring";
  if (eventType.startsWith("qa.")) return "qa";
  if (eventType.startsWith("delivery.")) return "delivery";
  if (eventType.startsWith("notification.")) return "notification";
  return "reconciliation";
}

export type OutboxJob = { outboxEventId: string };

export const outboxJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
  removeOnFail: false,
};

export function redisConnection(url: string) {
  const parsed = new URL(url);
  if (!["redis:", "rediss:"].includes(parsed.protocol)) throw new Error("Invalid REDIS_URL.");
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function createQueues(redisUrl: string) {
  const connection = redisConnection(redisUrl);
  return Object.fromEntries(
    queueNames.map((name) => [name, new Queue<OutboxJob>(`auvra-${name}`, { connection })]),
  ) as Record<QueueName, Queue<OutboxJob>>;
}
