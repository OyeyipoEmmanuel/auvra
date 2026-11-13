import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { planBuyerJob, prepareBuyerDraft, hireBuyerJob, ingestBuyerResult } = vi.hoisted(() => ({
  planBuyerJob: vi.fn().mockResolvedValue({ supplierJobId: "job-1" }),
  prepareBuyerDraft: vi.fn().mockResolvedValue({ draftId: "draft-1", charged: false }),
  hireBuyerJob: vi.fn().mockResolvedValue({ externalJobId: "market-job-1", charged: true }),
  ingestBuyerResult: vi.fn().mockResolvedValue({ customerVisible: false }),
}));

vi.mock("../apps/worker/src/marketplace/plan-buyer-job.js", () => ({ planBuyerJob }));
vi.mock("../apps/worker/src/marketplace/prepare-buyer-draft.js", () => ({
  prepareBuyerDraft,
  hireBuyerJob,
  BuyerActionBlockedError: class BuyerActionBlockedError extends Error {},
}));
vi.mock("../apps/worker/src/marketplace/ingest-buyer-result.js", () => ({ ingestBuyerResult }));

import { handleOutboxJob } from "../apps/worker/src/orchestration/event-handler";
import { queueForEvent } from "../apps/worker/src/orchestration/queues";

const previousMode = process.env.AUVRA_RUNTIME_MODE;
const previousAutomation = process.env.AUVRA_M8_AUTOMATION_ENABLED;
const previousDirectHire = process.env.AUVRA_M8_DIRECT_HIRE_ENABLED;

afterEach(() => {
  if (previousMode === undefined) delete process.env.AUVRA_RUNTIME_MODE;
  else process.env.AUVRA_RUNTIME_MODE = previousMode;
  if (previousAutomation === undefined) delete process.env.AUVRA_M8_AUTOMATION_ENABLED;
  else process.env.AUVRA_M8_AUTOMATION_ENABLED = previousAutomation;
  if (previousDirectHire === undefined) delete process.env.AUVRA_M8_DIRECT_HIRE_ENABLED;
  else process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = previousDirectHire;
});

function fixture(eventType: string, aggregateType: string, payloadJson: unknown) {
  const event = {
    id: crypto.randomUUID(),
    eventType,
    aggregateId: crypto.randomUUID(),
    aggregateType,
    payloadJson,
  };
  const db = {
    outboxEvent: { findUnique: vi.fn().mockResolvedValue(event) },
    projectTask: {
      findUnique: vi.fn().mockResolvedValue({
        id: event.aggregateId,
        projectId: "project-1",
        taskKey: "task-1",
        status: "READY",
      }),
    },
    supplierJob: {
      findUnique: vi.fn().mockResolvedValue({
        id: event.aggregateId,
        projectId: "project-1",
        task: { taskKey: "task-1" },
      }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    idempotencyRecord: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
  return { event, db };
}

describe("live hire worker dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    process.env.AUVRA_M8_AUTOMATION_ENABLED = "true";
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "false";
  });

  it("turns a ready live task into a read-only supplier proposal", async () => {
    const { event, db } = fixture("project.task_ready", "ProjectTask", {
      projectId: "project-1",
      taskId: "placeholder",
    });
    event.payloadJson = { projectId: "project-1", taskId: event.aggregateId };
    await handleOutboxJob(db, "procurement", event.eventType, { outboxEventId: event.id });
    expect(planBuyerJob).toHaveBeenCalledWith(db, "project-1", "task-1");
    expect(prepareBuyerDraft).not.toHaveBeenCalled();
  });

  it("dispatches a paid hire for a ready task when direct hiring is enabled", async () => {
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "true";
    const { event, db } = fixture("project.task_ready", "ProjectTask", {
      projectId: "project-1",
      taskId: "placeholder",
    });
    event.payloadJson = { projectId: "project-1", taskId: event.aggregateId };
    await handleOutboxJob(db, "procurement", event.eventType, { outboxEventId: event.id });
    expect(planBuyerJob).toHaveBeenCalledWith(db, "project-1", "task-1");
    expect(hireBuyerJob).toHaveBeenCalledWith(db, "project-1", "task-1", undefined, true);
    expect(prepareBuyerDraft).not.toHaveBeenCalled();
  });

  it("treats an already hired task as an observed replay", async () => {
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "true";
    const { event, db } = fixture("project.task_ready", "ProjectTask", {
      projectId: "project-1",
      taskId: "placeholder",
    });
    event.payloadJson = { projectId: "project-1", taskId: event.aggregateId };
    (db.projectTask.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: event.aggregateId,
      projectId: "project-1",
      taskKey: "task-1",
      status: "IN_PROGRESS",
    });
    (db.supplierJob.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ state: "HIRED" });
    await handleOutboxJob(db, "procurement", event.eventType, { outboxEventId: event.id });
    expect(hireBuyerJob).not.toHaveBeenCalled();
  });

  it("prepares a draft only from an exact approval carrying sharing consent", async () => {
    const { event, db } = fixture("approval.granted", "Approval", {
      projectId: "project-1",
      supplierJobId: "job-1",
      consentToShare: true,
    });
    expect(queueForEvent(event.eventType)).toBe("reconciliation");
    const supplierJob = db.supplierJob.findUnique as ReturnType<typeof vi.fn>;
    supplierJob.mockResolvedValue({
      id: "job-1",
      projectId: "project-1",
      task: { taskKey: "task-1" },
    });
    await handleOutboxJob(db, "reconciliation", event.eventType, { outboxEventId: event.id });
    expect(prepareBuyerDraft).toHaveBeenCalledWith(
      db,
      "project-1",
      "task-1",
      event.aggregateId,
      true,
    );
  });

  it("uses a paid hire after exact operator approval when enabled", async () => {
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "true";
    const { event, db } = fixture("approval.granted", "Approval", {
      projectId: "project-1",
      supplierJobId: "job-1",
      consentToShare: true,
    });
    await handleOutboxJob(db, "reconciliation", event.eventType, {
      outboxEventId: event.id,
    });
    expect(hireBuyerJob).toHaveBeenCalledWith(db, "project-1", "task-1", event.aggregateId, true);
    expect(prepareBuyerDraft).not.toHaveBeenCalled();
  });

  it("rejects approval events without sharing consent", async () => {
    const { event, db } = fixture("approval.granted", "Approval", {
      projectId: "project-1",
      supplierJobId: "job-1",
      consentToShare: false,
    });
    await expect(
      handleOutboxJob(db, "reconciliation", event.eventType, { outboxEventId: event.id }),
    ).rejects.toThrow("Invalid supplier approval event");
    expect(prepareBuyerDraft).not.toHaveBeenCalled();
  });

  it("ingests a submitted result privately, never as an automatic customer delivery", async () => {
    const { event, db } = fixture("supplier.job_submitted", "SupplierJob", {
      projectId: "project-1",
    });
    await handleOutboxJob(db, "monitoring", event.eventType, { outboxEventId: event.id });
    expect(ingestBuyerResult).toHaveBeenCalledWith(db, event.aggregateId);
  });

  it("does not dispatch marketplace work in sandbox mode", async () => {
    process.env.AUVRA_RUNTIME_MODE = "DEMO_SANDBOX";
    const { event, db } = fixture("project.task_ready", "ProjectTask", {
      projectId: "project-1",
      taskId: "placeholder",
    });
    event.payloadJson = { projectId: "project-1", taskId: event.aggregateId };
    await handleOutboxJob(db, "procurement", event.eventType, { outboxEventId: event.id });
    expect(planBuyerJob).not.toHaveBeenCalled();
  });

  it("does not repeat a supplier action after an observed queue redelivery", async () => {
    const { event, db } = fixture("project.task_ready", "ProjectTask", {
      projectId: "project-1",
      taskId: "placeholder",
    });
    event.payloadJson = { projectId: "project-1", taskId: event.aggregateId };
    const requestHash = createHash("sha256")
      .update(`${event.eventType}:${event.aggregateId}`)
      .digest("hex");
    (db.idempotencyRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      requestHash,
      completedAt: new Date(),
    });
    const outcome = await handleOutboxJob(db, "procurement", event.eventType, {
      outboxEventId: event.id,
    });
    expect(outcome.kind).toBe("REPLAY");
    expect(planBuyerJob).not.toHaveBeenCalled();
  });
});
