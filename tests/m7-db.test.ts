import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  claimOutboxBatch,
  publishOutboxBatch,
} from "../apps/worker/src/orchestration/outbox-publisher";
import {
  claimExternalAction,
  confirmExternalActionFromProviderRead,
  markExternalActionTimedOut,
  parkExpiredExternalActions,
  prepareExternalAction,
  requireExternalActionReview,
} from "../apps/worker/src/orchestration/external-actions";
import { handleOutboxJob } from "../apps/worker/src/orchestration/event-handler";
import { queueNames } from "../apps/worker/src/orchestration/queues";

const enabled = process.env.AUVRA_M7_DB_TEST === "1";
const db = enabled
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://auvra:auvra_local@localhost:55432/auvra?schema=public",
      }),
    })
  : null;

afterAll(async () => db?.$disconnect());

function queues(add: ReturnType<typeof vi.fn>) {
  return Object.fromEntries(queueNames.map((name) => [name, { add }])) as unknown as Parameters<
    typeof publishOutboxBatch
  >[1];
}

describe.skipIf(!enabled)("M7 PostgreSQL outbox leases", () => {
  it("observes a duplicate request event once without re-running its domain write", async () => {
    if (!db) throw new Error("Local database required.");
    const event = await db.outboxEvent.create({
      data: {
        aggregateType: "ServiceRequest",
        aggregateId: crypto.randomUUID(),
        eventType: "request.submitted",
        idempotencyKey: `m7-request:${crypto.randomUUID()}`,
        payloadJson: {},
      },
    });
    try {
      const data = { outboxEventId: event.id };
      expect((await handleOutboxJob(db, "analysis", event.eventType, data)).kind).toBe("OBSERVED");
      expect((await handleOutboxJob(db, "analysis", event.eventType, data)).kind).toBe("REPLAY");
      expect(
        await db.idempotencyRecord.count({
          where: { scope: "M7_COMMITTED_EVENT", idempotencyKey: event.id },
        }),
      ).toBe(1);
    } finally {
      await db.idempotencyRecord.deleteMany({
        where: { scope: "M7_COMMITTED_EVENT", idempotencyKey: event.id },
      });
      await db.outboxEvent.delete({ where: { id: event.id } });
    }
  });

  it("parks a timed-out external action and never retries it blindly", async () => {
    if (!db) throw new Error("Local database required.");
    const identity = {
      idempotencyKey: `m7-action:${crypto.randomUUID()}`,
      provider: "NEAR_AGENT_MARKET",
      actionType: "HIRE",
      requestHash: "a".repeat(64),
    };
    try {
      expect((await prepareExternalAction(db, identity)).kind).toBe("PREPARED");
      expect((await prepareExternalAction(db, identity)).kind).toBe("EXISTING");
      await expect(
        prepareExternalAction(db, { ...identity, requestHash: "b".repeat(64) }),
      ).rejects.toThrow(/Conflicting/);
      const now = new Date();
      expect(await claimExternalAction(db, identity.idempotencyKey, "worker-a", now)).toBe(
        "CLAIMED",
      );
      expect(await claimExternalAction(db, identity.idempotencyKey, "worker-b", now)).toBe(
        "NOT_CLAIMED",
      );
      expect(
        await parkExpiredExternalActions(
          db,
          new Date(now.getTime() + 31_000),
          identity.idempotencyKey,
        ),
      ).toBe(1);
      expect(await claimExternalAction(db, identity.idempotencyKey, "worker-b")).toBe(
        "NOT_CLAIMED",
      );
      expect(await requireExternalActionReview(db, identity.idempotencyKey)).toBe(
        "REVIEW_REQUIRED",
      );
    } finally {
      await db.externalAction.deleteMany({ where: { idempotencyKey: identity.idempotencyKey } });
    }
  });

  it("confirms an unknown action only from a provider reconciliation result", async () => {
    if (!db) throw new Error("Local database required.");
    const identity = {
      idempotencyKey: `m7-action:${crypto.randomUUID()}`,
      provider: "NEAR_AGENT_MARKET",
      actionType: "HIRE",
      requestHash: "c".repeat(64),
    };
    try {
      await prepareExternalAction(db, identity);
      const now = new Date();
      await claimExternalAction(db, identity.idempotencyKey, "worker-a", now);
      await markExternalActionTimedOut(
        db,
        identity.idempotencyKey,
        new Date(now.getTime() + 31_000),
      );
      expect(
        await confirmExternalActionFromProviderRead(db, identity.idempotencyKey, "remote-fixture"),
      ).toBe("CONFIRMED");
      expect(await claimExternalAction(db, identity.idempotencyKey, "worker-b")).toBe(
        "NOT_CLAIMED",
      );
    } finally {
      await db.externalAction.deleteMany({ where: { idempotencyKey: identity.idempotencyKey } });
    }
  });

  it("replays project events once and releases dependent tasks only after completion", async () => {
    if (!db) throw new Error("Local database required.");
    const customer = await db.user.create({ data: { role: "CUSTOMER" } });
    const request = await db.serviceRequest.create({
      data: { customerId: customer.id, rawBrief: "M7 scheduler fixture", state: "PROJECT_CREATED" },
    });
    const project = await db.project.create({
      data: { requestId: request.id, customerId: customer.id },
    });
    const first = await db.projectTask.create({
      data: {
        projectId: project.id,
        taskKey: "requirements",
        title: "Requirements",
        objective: "Requirements",
        inputContractJson: {},
        outputContractJson: {},
        dependenciesJson: [],
        capabilitiesJson: [],
        validationRulesJson: [],
        status: "PLANNED",
        budgetMinor: 100n,
        budgetCurrency: "USD",
      },
    });
    const second = await db.projectTask.create({
      data: {
        projectId: project.id,
        taskKey: "production",
        title: "Production",
        objective: "Production",
        inputContractJson: {},
        outputContractJson: {},
        dependenciesJson: ["requirements"],
        capabilitiesJson: [],
        validationRulesJson: [],
        status: "PLANNED",
        budgetMinor: 100n,
        budgetCurrency: "USD",
      },
    });
    const created = await db.outboxEvent.create({
      data: {
        aggregateType: "Project",
        aggregateId: project.id,
        eventType: "project.created_with_demo_funding",
        idempotencyKey: `m7-project:${project.id}`,
        payloadJson: { projectId: project.id },
      },
    });
    try {
      const data = { outboxEventId: created.id };
      expect((await handleOutboxJob(db, "procurement", created.eventType, data)).kind).toBe(
        "SCHEDULED",
      );
      expect((await handleOutboxJob(db, "procurement", created.eventType, data)).kind).toBe(
        "REPLAY",
      );
      expect((await db.projectTask.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(
        "READY",
      );
      expect((await db.projectTask.findUniqueOrThrow({ where: { id: second.id } })).status).toBe(
        "PLANNED",
      );
      await db.projectTask.update({ where: { id: first.id }, data: { status: "COMPLETED" } });
      const completed = await db.outboxEvent.create({
        data: {
          aggregateType: "ProjectTask",
          aggregateId: first.id,
          eventType: "project.task_completed",
          idempotencyKey: `m7-completed:${first.id}`,
          payloadJson: { projectId: project.id, taskId: first.id },
        },
      });
      const completionData = { outboxEventId: completed.id };
      expect(
        (await handleOutboxJob(db, "procurement", completed.eventType, completionData)).kind,
      ).toBe("SCHEDULED");
      expect(
        (await handleOutboxJob(db, "procurement", completed.eventType, completionData)).kind,
      ).toBe("REPLAY");
      expect((await db.projectTask.findUniqueOrThrow({ where: { id: second.id } })).status).toBe(
        "READY",
      );
      expect(
        await db.outboxEvent.count({
          where: { eventType: "project.task_ready", aggregateId: { in: [first.id, second.id] } },
        }),
      ).toBe(2);
    } finally {
      await db.idempotencyRecord.deleteMany({
        where: { scope: "M7_TASK_SCHEDULER", idempotencyKey: { in: [`outbox:${created.id}`] } },
      });
      const taskEvents = await db.outboxEvent.findMany({
        where: { aggregateId: { in: [project.id, first.id, second.id] } },
        select: { id: true },
      });
      await db.idempotencyRecord.deleteMany({
        where: { idempotencyKey: { in: taskEvents.map((event) => `outbox:${event.id}`) } },
      });
      await db.outboxEvent.deleteMany({
        where: { aggregateId: { in: [project.id, first.id, second.id] } },
      });
      await db.projectTask.deleteMany({ where: { projectId: project.id } });
      await db.project.delete({ where: { id: project.id } });
      await db.serviceRequest.delete({ where: { id: request.id } });
      await db.user.delete({ where: { id: customer.id } });
    }
  });

  it("recovers an expired claim and publishes once after a worker restart", async () => {
    if (!db) throw new Error("Local database required.");
    const event = await db.outboxEvent.create({
      data: {
        aggregateType: "M7Fixture",
        aggregateId: crypto.randomUUID(),
        eventType: "request.submitted",
        idempotencyKey: `m7-fixture:${crypto.randomUUID()}`,
        payloadJson: {},
      },
    });
    try {
      const now = new Date();
      const first = await claimOutboxBatch(db, "worker-before-restart", now, 25, event.id);
      expect(first.some((item) => item.id === event.id)).toBe(true);
      const second = await claimOutboxBatch(db, "worker-after-restart", now, 25, event.id);
      expect(second.some((item) => item.id === event.id)).toBe(false);

      const add = vi.fn().mockResolvedValue({});
      const resumed = await publishOutboxBatch(
        db,
        queues(add),
        "worker-after-restart",
        new Date(now.getTime() + 31_000),
        event.id,
      );
      expect(resumed.published).toBeGreaterThanOrEqual(1);
      expect(add).toHaveBeenCalledWith(
        "request.submitted",
        { outboxEventId: event.id },
        expect.objectContaining({ jobId: event.id }),
      );
      expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).state).toBe(
        "PUBLISHED",
      );
    } finally {
      await db.outboxEvent.delete({ where: { id: event.id } });
    }
  });

  it("retains failed publication for a later retry", async () => {
    if (!db) throw new Error("Local database required.");
    const event = await db.outboxEvent.create({
      data: {
        aggregateType: "M7Fixture",
        aggregateId: crypto.randomUUID(),
        eventType: "quote.presented",
        idempotencyKey: `m7-fixture:${crypto.randomUUID()}`,
        payloadJson: {},
      },
    });
    try {
      const failed = await publishOutboxBatch(
        db,
        queues(vi.fn().mockRejectedValue(new Error("Redis unavailable"))),
        "worker-retry",
        new Date(),
        event.id,
      );
      expect(failed.retried).toBeGreaterThanOrEqual(1);
      const pending = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
      expect(pending.state).toBe("RETRY_PENDING");
      expect(pending.attempts).toBe(1);
      expect(pending.lastError).toBe("QUEUE_UNAVAILABLE");
    } finally {
      await db.outboxEvent.delete({ where: { id: event.id } });
    }
  });
});
