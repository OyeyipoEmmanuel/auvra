import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { recordPaidHire } from "../apps/worker/src/marketplace/record-paid-hire";

const authorized = {
  id: "1dfb97a9-a02f-4895-98b6-10cd5191a0f4",
  projectId: "00b986cd-7690-467b-9623-3b3176bc423a",
  taskId: "c1499e8a-5702-4c9c-9771-5a79146f186a",
  externalServiceId: "service-1",
  authorizedMinor: 1500n,
  currency: "USD",
  requestHash: "a".repeat(64),
  idempotencyKey: "auvra:hire:1dfb97a9-a02f-4895-98b6-10cd5191a0f4",
};
const created = {
  jobId: "d71f1b2f-8a30-4f6d-aaf6-b22ae11f2449",
  assignmentId: "0b6ec1dc-6462-4ae2-8847-5e881be18e97",
  chargedMinor: 1500n,
  currency: "USD" as const,
  replayed: false,
};

function database(reservationCount = 1) {
  const tx = {
    supplierJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    spendReservation: { updateMany: vi.fn().mockResolvedValue({ count: reservationCount }) },
    externalAction: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    project: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    projectTask: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = { $transaction: vi.fn((run: (value: typeof tx) => unknown) => run(tx)) };
  return { db: db as unknown as PrismaClient, tx };
}

describe("paid hire recording", () => {
  it("records the provider job and commits only the matching reservation", async () => {
    const { db, tx } = database();
    await recordPaidHire(db, authorized, created);
    expect(tx.supplierJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: "HIRED" }) }),
    );
    expect(tx.spendReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ idempotencyKey: authorized.idempotencyKey }),
        data: { state: "COMMITTED" },
      }),
    );
    expect(tx.externalAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: "CONFIRMED" }) }),
    );
    expect(tx.outboxEvent.create).toHaveBeenCalledOnce();
  });

  it("refuses to record a hire without the exact reservation", async () => {
    const { db, tx } = database(0);
    await expect(recordPaidHire(db, authorized, created)).rejects.toThrow(
      "Exact supplier reservation is missing",
    );
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
