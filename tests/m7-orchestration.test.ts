import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { publishOutboxBatch } from "../apps/worker/src/orchestration/outbox-publisher";
import { handleOutboxJob } from "../apps/worker/src/orchestration/event-handler";
import { queueForEvent, queueNames, type QueueName } from "../apps/worker/src/orchestration/queues";
import { readyTaskIds } from "../apps/worker/src/orchestration/task-scheduler";

function fixtureDb(event: { id: string; eventType: string; attempts: number }) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: vi.fn().mockResolvedValue([{ id: event.id }]),
        outboxEvent: {
          updateMany,
          findMany: vi.fn().mockResolvedValue([event]),
        },
      }),
    ),
    outboxEvent: { updateMany },
  } as unknown as PrismaClient;
  return { db, updateMany };
}

function fixtureQueues(add: ReturnType<typeof vi.fn>) {
  return Object.fromEntries(queueNames.map((name) => [name, { add }])) as unknown as Parameters<
    typeof publishOutboxBatch
  >[1];
}

describe("M7 outbox and dependency scheduling foundation", () => {
  it.each([
    ["request.submitted", "analysis"],
    ["supplier.discovery_ready", "matching"],
    ["quote.presented", "quoting"],
    ["project.created_with_bachs_sandbox", "procurement"],
    ["project.task_ready", "procurement"],
    ["project.task_completed", "procurement"],
    ["supplier.job_updated", "monitoring"],
    ["qa.passed", "qa"],
    ["delivery.ready", "delivery"],
    ["notification.created", "notification"],
    ["payment.reconciled", "reconciliation"],
  ] as Array<[string, QueueName]>)("routes %s to %s", (event, queue) => {
    expect(queueForEvent(event)).toBe(queue);
  });

  it("publishes only the outbox ID with a stable BullMQ job ID", async () => {
    const event = {
      id: crypto.randomUUID(),
      eventType: "project.created_with_bachs_sandbox",
      attempts: 0,
    };
    const { db, updateMany } = fixtureDb(event);
    const add = vi.fn().mockResolvedValue({});
    const result = await publishOutboxBatch(db, fixtureQueues(add), "worker-a");
    expect(result).toEqual({ claimed: 1, published: 1, retried: 0, deadLettered: 0 });
    expect(add).toHaveBeenCalledWith(
      event.eventType,
      { outboxEventId: event.id },
      expect.objectContaining({ jobId: event.id }),
    );
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: event.id, leaseOwner: "worker-a" }),
        data: expect.objectContaining({ state: "PUBLISHED", leaseOwner: null }),
      }),
    );
  });

  it("dead-letters exhausted queue publication without exposing the error", async () => {
    const event = { id: crypto.randomUUID(), eventType: "request.submitted", attempts: 7 };
    const { db, updateMany } = fixtureDb(event);
    const add = vi.fn().mockRejectedValue(new Error("redis://secret@host"));
    const result = await publishOutboxBatch(db, fixtureQueues(add), "worker-b");
    expect(result.deadLettered).toBe(1);
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: "DEAD_LETTER",
          attempts: 8,
          lastError: "QUEUE_UNAVAILABLE",
        }),
      }),
    );
  });

  it("releases only tasks whose dependencies completed, even after out-of-order updates", () => {
    const tasks = [
      { id: "a", taskKey: "requirements", status: "COMPLETED", dependenciesJson: [] },
      { id: "b", taskKey: "production", status: "PLANNED", dependenciesJson: ["requirements"] },
      { id: "c", taskKey: "qa", status: "PLANNED", dependenciesJson: ["production"] },
    ];
    expect(readyTaskIds(tasks)).toEqual(["b"]);
    tasks[1]!.status = "COMPLETED";
    expect(readyTaskIds(tasks)).toEqual(["c"]);
    tasks[2]!.dependenciesJson = ["missing"];
    expect(readyTaskIds(tasks)).toEqual([]);
  });

  it("fails closed on a dependency cycle", () => {
    expect(
      readyTaskIds([
        { id: "a", taskKey: "a", status: "PLANNED", dependenciesJson: ["b"] },
        { id: "b", taskKey: "b", status: "PLANNED", dependenciesJson: ["a"] },
      ]),
    ).toEqual([]);
  });

  it("fails a poisoned or unsupported job without performing a domain action", async () => {
    const id = crypto.randomUUID();
    const db = {
      outboxEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id,
          eventType: "supplier.job_updated",
          aggregateId: crypto.randomUUID(),
        }),
      },
      projectTask: { updateMany: vi.fn() },
    } as unknown as PrismaClient;
    await expect(
      handleOutboxJob(db, "monitoring", "supplier.job_updated", { outboxEventId: id }),
    ).rejects.toThrow(/Unsupported outbox event/);
    expect(db.projectTask.updateMany).not.toHaveBeenCalled();
    await expect(
      handleOutboxJob(db, "procurement", "supplier.job_updated", { outboxEventId: id }),
    ).rejects.toThrow(/no matching committed event/);
  });
});
