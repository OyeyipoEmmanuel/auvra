import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { queueForEvent, type OutboxJob, type QueueName } from "./queues.js";
import { scheduleReadyTasks } from "./task-scheduler.js";

const committedStateEvents = new Set([
  "request.draft_created",
  "request.draft_updated",
  "request.submitted",
  "request.analysis_started",
  "request.needs_clarification",
  "request.clarifications_answered",
  "request.scoped",
  "request.unsupported",
  "request.budget_increased",
  "request.scope_revised",
  "quote.presented",
  "quote.accepted",
  "quote.rejected",
  "supplier.discovery_not_available",
  "supplier.discovery_over_budget",
  "supplier.discovery_ready_for_quote",
  "approval.granted",
  "delivery.customer_accepted",
  "policy.pause_changed",
  "supplier.job_hired",
  "supplier.job_submitted",
  "qa.deterministic_completed",
  "qa.qualitative_completed",
]);

function payloadRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** These events already changed domain state in the web transaction. Observe once, not re-run it. */
async function observeCommittedEvent(
  db: PrismaClient,
  event: {
    id: string;
    eventType: string;
    aggregateId: string;
  },
) {
  const scope = "M7_COMMITTED_EVENT";
  const requestHash = createHash("sha256")
    .update(`${event.eventType}:${event.aggregateId}`)
    .digest("hex");
  const key = { scope, idempotencyKey: event.id };
  const existing = await db.idempotencyRecord.findUnique({
    where: { scope_idempotencyKey: key },
  });
  if (existing) {
    if (existing.requestHash !== requestHash || !existing.completedAt) {
      throw new Error("Conflicting or incomplete outbox observation.");
    }
    return { kind: "REPLAY" as const };
  }
  await db.idempotencyRecord.create({
    data: { ...key, requestHash, completedAt: new Date(), responseJson: { observed: true } },
  });
  return { kind: "OBSERVED" as const };
}

/** No supplier hire, payment, acceptance, or external message is performed in M7. */
export async function handleOutboxJob(
  db: PrismaClient,
  queue: QueueName,
  name: string,
  data: OutboxJob,
) {
  const event = await db.outboxEvent.findUnique({ where: { id: data.outboxEventId } });
  if (!event || event.eventType !== name || queueForEvent(event.eventType) !== queue) {
    throw new Error("Outbox job has no matching committed event.");
  }

  if (event.eventType.startsWith("project.created_")) {
    if (event.aggregateType !== "Project") throw new Error("Invalid project event aggregate.");
    return scheduleReadyTasks(db, event.aggregateId, { id: event.id, type: event.eventType });
  }

  if (event.eventType === "project.task_completed") {
    const payload = payloadRecord(event.payloadJson);
    if (
      event.aggregateType !== "ProjectTask" ||
      payload?.taskId !== event.aggregateId ||
      typeof payload.projectId !== "string"
    ) {
      throw new Error("Invalid task completion event.");
    }
    return scheduleReadyTasks(db, payload.projectId, {
      id: event.id,
      type: event.eventType,
      completedTaskId: event.aggregateId,
    });
  }

  if (event.eventType === "project.task_ready") {
    const payload = payloadRecord(event.payloadJson);
    if (event.aggregateType !== "ProjectTask" || payload?.taskId !== event.aggregateId) {
      throw new Error("Invalid task-ready event.");
    }
    // M8 will scan READY tasks from Postgres; no paid action is dispatched here.
    return observeCommittedEvent(db, event);
  }

  if (committedStateEvents.has(event.eventType)) return observeCommittedEvent(db, event);
  throw new Error("Unsupported outbox event; manual review required.");
}
