import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

type TaskSnapshot = {
  id: string;
  taskKey: string;
  status: string;
  version?: number;
  dependenciesJson: unknown;
};

/** A malformed or incomplete DAG never releases a task for execution. */
export function readyTaskIds(tasks: TaskSnapshot[]): string[] {
  const byKey = new Map(tasks.map((task) => [task.taskKey, task]));
  if (byKey.size !== tasks.length) return [];
  const ready: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclic = (key: string): boolean => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    const task = byKey.get(key);
    const dependencies = task?.dependenciesJson;
    if (!Array.isArray(dependencies)) return true;
    for (const dependency of dependencies) {
      if (typeof dependency !== "string" || !byKey.has(dependency) || cyclic(dependency)) {
        return true;
      }
    }
    visiting.delete(key);
    visited.add(key);
    return false;
  };
  if (tasks.some((task) => cyclic(task.taskKey))) return [];
  for (const task of tasks) {
    if (task.status !== "PLANNED") continue;
    if (
      !Array.isArray(task.dependenciesJson) ||
      !task.dependenciesJson.every((dependency) => typeof dependency === "string")
    )
      return [];
    const dependencies = task.dependenciesJson as string[];
    if (
      dependencies.includes(task.taskKey) ||
      dependencies.some((dependency) => !byKey.has(dependency))
    )
      return [];
    if (dependencies.every((dependency) => byKey.get(dependency)?.status === "COMPLETED")) {
      ready.push(task.id);
    }
  }
  return ready;
}

/** Only marks dependency-ready tasks; hiring remains disabled until M8 gates pass. */
export async function scheduleReadyTasks(
  db: PrismaClient,
  projectId: string,
  event?: { id: string; type: string; completedTaskId?: string },
) {
  return db.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Project" WHERE id = ${projectId}::uuid FOR UPDATE
      `;
      if (locked.length !== 1) return { kind: "NOT_FOUND" as const, readyTaskIds: [] };
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: { tasks: true },
      });
      if (["BLOCKED", "DISPUTED", "CANCELLED", "FAILED", "CLOSED"].includes(project.state)) {
        return { kind: "PAUSED" as const, readyTaskIds: [] };
      }
      if (event?.completedTaskId) {
        const completed = project.tasks.find((task) => task.id === event.completedTaskId);
        if (!completed || completed.status !== "COMPLETED") {
          throw new Error("Task completion event does not match completed project state.");
        }
      }
      const idempotencyKey = event ? `outbox:${event.id}` : null;
      const requestHash = event
        ? createHash("sha256")
            .update(`${event.type}:${projectId}:${event.completedTaskId ?? ""}`)
            .digest("hex")
        : null;
      if (idempotencyKey) {
        const previous = await tx.idempotencyRecord.findUnique({
          where: { scope_idempotencyKey: { scope: "M7_TASK_SCHEDULER", idempotencyKey } },
        });
        if (previous) {
          if (previous.requestHash !== requestHash || !previous.completedAt) {
            throw new Error("Conflicting or incomplete scheduler replay.");
          }
          return { kind: "REPLAY" as const, readyTaskIds: [] };
        }
      }
      const ids = readyTaskIds(project.tasks);
      for (const id of ids) {
        const task = project.tasks.find((item) => item.id === id)!;
        const updated = await tx.projectTask.updateMany({
          where: { id, projectId, status: "PLANNED", version: task.version },
          data: { status: "READY", version: { increment: 1 } },
        });
        if (updated.count === 1) {
          await tx.outboxEvent.create({
            data: {
              aggregateType: "ProjectTask",
              aggregateId: id,
              eventType: "project.task_ready",
              idempotencyKey: `task:${id}:ready`,
              payloadJson: { projectId, taskId: id },
            },
          });
        }
      }
      if (idempotencyKey && requestHash) {
        await tx.idempotencyRecord.create({
          data: {
            scope: "M7_TASK_SCHEDULER",
            idempotencyKey,
            requestHash,
            responseJson: { readyTaskIds: ids },
            completedAt: new Date(),
          },
        });
      }
      return { kind: "SCHEDULED" as const, readyTaskIds: ids };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
