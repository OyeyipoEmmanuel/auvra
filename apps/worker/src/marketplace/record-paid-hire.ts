import type { PrismaClient } from "@prisma/client";

import type { CreatedMarketJob } from "./job-contract.js";

type HireRecord = {
  id: string;
  projectId: string;
  taskId: string;
  externalServiceId: string;
  authorizedMinor: bigint;
  currency: string;
  requestHash: string;
  idempotencyKey: string;
};

/** Commit provider evidence, spend reservation, and project progress together. */
export async function recordPaidHire(db: PrismaClient, job: HireRecord, created: CreatedMarketJob) {
  if (created.currency !== job.currency || created.chargedMinor !== job.authorizedMinor) {
    throw new Error("Provider charge does not match the authorized supplier price.");
  }
  await db.$transaction(async (tx) => {
    const changed = await tx.supplierJob.updateMany({
      where: {
        id: job.id,
        state: "PROPOSED",
        externalJobId: null,
        requestHash: job.requestHash,
      },
      data: {
        externalJobId: created.jobId,
        state: "HIRED",
        committedMinor: created.chargedMinor,
        rawStatus: "hired",
        lastObservedAt: new Date(),
        providerStatusJson: { assignmentId: created.assignmentId, replayed: created.replayed },
      },
    });
    if (changed.count !== 1) {
      const current = await tx.supplierJob.findUnique({ where: { id: job.id } });
      if (
        current?.externalJobId === created.jobId &&
        current.committedMinor === created.chargedMinor
      )
        return;
      throw new Error("Supplier job changed while recording the paid hire.");
    }
    const reservation = await tx.spendReservation.updateMany({
      where: {
        idempotencyKey: job.idempotencyKey,
        projectId: job.projectId,
        taskId: job.taskId,
        serviceId: job.externalServiceId,
        amountMinor: job.authorizedMinor,
        currency: job.currency,
        state: "RESERVED",
      },
      data: { state: "COMMITTED" },
    });
    if (reservation.count !== 1) throw new Error("Exact supplier reservation is missing.");
    const action = await tx.externalAction.updateMany({
      where: {
        idempotencyKey: job.idempotencyKey,
        requestHash: job.requestHash,
        state: { in: ["IN_FLIGHT", "UNKNOWN"] },
      },
      data: {
        state: "CONFIRMED",
        externalId: created.jobId,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    if (action.count !== 1) throw new Error("Paid hire action was not claimable.");
    await tx.project.updateMany({
      where: { id: job.projectId, state: { in: ["PLANNING", "PROCUREMENT"] } },
      data: { state: "RUNNING", startedAt: new Date() },
    });
    await tx.projectTask.updateMany({
      where: { id: job.taskId, status: "READY" },
      data: { status: "IN_PROGRESS" },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        eventType: "MARKETPLACE_PAID_HIRE_CONFIRMED",
        projectId: job.projectId,
        supplierJobId: job.id,
        inputHash: job.requestHash,
        metadataJson: {
          externalJobId: created.jobId,
          assignmentId: created.assignmentId,
          amountMinor: created.chargedMinor.toString(),
          currency: created.currency,
          replayed: created.replayed,
          settlementVerified: false,
        },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "SupplierJob",
        aggregateId: job.id,
        eventType: "supplier.job_hired",
        idempotencyKey: `supplier:${job.id}:hired`,
        payloadJson: { projectId: job.projectId, externalJobId: created.jobId },
      },
    });
  });
}
