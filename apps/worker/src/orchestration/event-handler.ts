import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { ingestBuyerResult } from "../marketplace/ingest-buyer-result.js";
import { planBuyerJob } from "../marketplace/plan-buyer-job.js";
import {
  BuyerActionBlockedError,
  hireBuyerJob,
  prepareBuyerDraft,
} from "../marketplace/prepare-buyer-draft.js";
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

/** A queue redelivery after successful observation must not re-run provider work. */
async function observedReplay(
  db: PrismaClient,
  event: { id: string; eventType: string; aggregateId: string },
) {
  const existing = await db.idempotencyRecord.findUnique({
    where: { scope_idempotencyKey: { scope: "M7_COMMITTED_EVENT", idempotencyKey: event.id } },
  });
  if (!existing) return null;
  const hash = createHash("sha256").update(`${event.eventType}:${event.aggregateId}`).digest("hex");
  if (existing.requestHash !== hash || !existing.completedAt) {
    throw new Error("Conflicting or incomplete outbox observation.");
  }
  return { kind: "REPLAY" as const };
}

/** Routes approved work through the configured marketplace buyer action. */
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
    if (
      event.aggregateType !== "ProjectTask" ||
      payload?.taskId !== event.aggregateId ||
      typeof payload.projectId !== "string"
    ) {
      throw new Error("Invalid task-ready event.");
    }
    const replay = await observedReplay(db, event);
    if (replay) return replay;
    if (
      process.env.AUVRA_RUNTIME_MODE === "LIVE_MARKET" &&
      process.env.AUVRA_M8_AUTOMATION_ENABLED === "true"
    ) {
      const task = await db.projectTask.findUnique({ where: { id: event.aggregateId } });
      if (!task || task.projectId !== payload.projectId)
        throw new Error("Task-ready event has no matching task.");
      if (task.status !== "READY") {
        const existingHire = await db.supplierJob.findFirst({
          where: {
            taskId: task.id,
            state: { in: ["HIRED", "ACTIVE", "SUBMITTED", "QA_PASSED", "ACCEPTED"] },
          },
        });
        if (!existingHire) throw new Error("Task changed without a confirmed supplier hire.");
        return observeCommittedEvent(db, event);
      }
      await planBuyerJob(db, task.projectId, task.taskKey);
      if (process.env.AUVRA_M8_DIRECT_HIRE_ENABLED === "true") {
        try {
          await hireBuyerJob(db, task.projectId, task.taskKey, undefined, true);
        } catch (error) {
          // Policy denial leaves a proposal for operator review. Provider failures retry the event.
          if (!(error instanceof BuyerActionBlockedError)) throw error;
        }
      }
    }
    return observeCommittedEvent(db, event);
  }

  if (event.eventType === "approval.granted") {
    const payload = payloadRecord(event.payloadJson);
    if (
      event.aggregateType !== "Approval" ||
      typeof payload?.projectId !== "string" ||
      typeof payload.supplierJobId !== "string" ||
      payload.consentToShare !== true
    )
      throw new Error("Invalid supplier approval event.");
    const replay = await observedReplay(db, event);
    if (replay) return replay;
    if (
      process.env.AUVRA_RUNTIME_MODE === "LIVE_MARKET" &&
      process.env.AUVRA_M8_AUTOMATION_ENABLED === "true"
    ) {
      const job = await db.supplierJob.findUnique({
        where: { id: payload.supplierJobId },
        include: { task: true },
      });
      if (!job || job.projectId !== payload.projectId)
        throw new Error("Approval has no matching supplier job.");
      const buyerAction =
        process.env.AUVRA_M8_DIRECT_HIRE_ENABLED === "true" ? hireBuyerJob : prepareBuyerDraft;
      await buyerAction(
        db,
        job.projectId,
        job.task.taskKey,
        event.aggregateId,
        payload.consentToShare === true,
      );
    }
    return observeCommittedEvent(db, event);
  }

  if (event.eventType === "supplier.job_submitted") {
    const payload = payloadRecord(event.payloadJson);
    if (event.aggregateType !== "SupplierJob" || typeof payload?.projectId !== "string") {
      throw new Error("Invalid supplier submission event.");
    }
    const replay = await observedReplay(db, event);
    if (replay) return replay;
    if (
      process.env.AUVRA_RUNTIME_MODE === "LIVE_MARKET" &&
      process.env.AUVRA_M8_AUTOMATION_ENABLED === "true"
    ) {
      const job = await db.supplierJob.findUnique({ where: { id: event.aggregateId } });
      if (!job || job.projectId !== payload.projectId)
        throw new Error("Submission has no matching supplier job.");
      await ingestBuyerResult(db, job.id);
    }
    return observeCommittedEvent(db, event);
  }

  if (committedStateEvents.has(event.eventType)) return observeCommittedEvent(db, event);
  throw new Error("Unsupported outbox event; manual review required.");
}
