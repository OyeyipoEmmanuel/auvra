import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { reserveSupplierSpend } from "../apps/worker/src/policy/reserve-spend";

const enabled = process.env.AUVRA_M6_DB_TEST === "1";
const db = enabled
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://auvra:auvra_local@localhost:55432/auvra?schema=public",
      }),
    })
  : null;

afterAll(async () => {
  await db?.$disconnect();
});

describe.skipIf(!enabled)("M6 local PostgreSQL cap concurrency", () => {
  it("rejects an unbalanced ledger transaction at commit", async () => {
    if (!db) throw new Error("Local database required.");
    await expect(
      db.$transaction(async (tx) => {
        await tx.ledgerTransaction.create({
          data: { transactionType: "TEST_UNBALANCED", asset: "USD", metadataJson: {} },
        });
      }),
    ).rejects.toThrow(/Unbalanced ledger transaction/);
  });

  it("never reserves more than the project cap", async () => {
    if (!db) throw new Error("Local database required.");
    const customer = await db.user.create({ data: { role: "CUSTOMER" } });
    const operator = await db.user.create({ data: { role: "OPERATOR" } });
    const request = await db.serviceRequest.create({
      data: { customerId: customer.id, rawBrief: "Integration fixture", state: "PROJECT_CREATED" },
    });
    const quote = await db.quote.create({
      data: {
        requestId: request.id,
        version: 1,
        state: "ACCEPTED",
        currency: "USD",
        decimals: 2,
        customerTotalMinor: 200n,
        supplierCapMinor: 100n,
        executionCostMinor: 100n,
        reserveMinor: 0n,
        feeMinor: 100n,
        estimatedMarginMinor: 100n,
        scopeJson: {},
        assumptionsJson: [],
        exclusionsJson: [],
        termsJson: {},
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: new Date(),
      },
    });
    const project = await db.project.create({
      data: { requestId: request.id, customerId: customer.id },
    });
    const task = await db.projectTask.create({
      data: {
        projectId: project.id,
        taskKey: "task",
        title: "Fixture",
        objective: "Fixture",
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
    const payment = await db.customerPayment.create({
      data: {
        customerId: customer.id,
        quoteId: quote.id,
        projectId: project.id,
        provider: "BACHS",
        providerReference: project.id,
        state: "ALLOCATED",
        currency: "USD",
        amountMinor: 200n,
        verifiedAt: new Date(),
        allocatedAt: new Date(),
      },
    });
    const policy = await db.policyVersion.create({
      data: {
        policyKey: "LIVE_PROCUREMENT",
        version: Math.floor(Date.now() / 1000),
        active: true,
        rulesJson: {
          schemaVersion: 1,
          paused: false,
          allowedCurrencies: ["USD"],
          allowedServices: ["service-fixture"],
          perJobCapMinor: "100",
          projectCapMinor: "100",
          dailyCapMinor: "100",
          autoApprovalCeilingMinor: "100",
          contributionFloorMinor: "20",
          firstLiveHireRequiresApproval: true,
        },
      },
    });
    const approval = await db.approval.create({
      data: {
        approvalType: "FIRST_LIVE_HIRE",
        state: "APPROVED",
        projectId: project.id,
        policyVersionId: policy.id,
        amountMinor: 60n,
        currency: "USD",
        reason: "Fixture",
        requestedById: customer.id,
        decidedById: operator.id,
        decidedAt: new Date(),
      },
    });

    try {
      const proof = async () => ({
        source: "MARKETPLACE_API" as const,
        asset: "USD",
        availableMinor: 120n,
        observedAt: new Date(),
      });
      const attempts = await Promise.allSettled(
        ["a", "b"].map((suffix) =>
          reserveSupplierSpend(
            db,
            {
              projectId: project.id,
              taskId: task.id,
              serviceId: "service-fixture",
              amountMinor: 60n,
              currency: "USD",
              approvalId: approval.id,
              idempotencyKey: `m6-fixture:${project.id}:${suffix}`,
            },
            proof,
          ),
        ),
      );
      const reserved = await db.spendReservation.aggregate({
        where: { projectId: project.id, state: "RESERVED" },
        _sum: { amountMinor: true },
      });
      expect(reserved._sum.amountMinor).toBe(60n);
      expect(
        attempts.some(
          (attempt) => attempt.status === "fulfilled" && attempt.value.kind === "RESERVED",
        ),
      ).toBe(true);
    } finally {
      await db.spendReservation.deleteMany({ where: { projectId: project.id } });
      await db.auditEvent.deleteMany({ where: { projectId: project.id } });
      await db.approval.delete({ where: { id: approval.id } });
      await db.policyVersion.delete({ where: { id: policy.id } });
      await db.customerPayment.delete({ where: { id: payment.id } });
      await db.projectTask.delete({ where: { id: task.id } });
      await db.project.delete({ where: { id: project.id } });
      await db.quote.delete({ where: { id: quote.id } });
      await db.serviceRequest.delete({ where: { id: request.id } });
      await db.user.deleteMany({ where: { id: { in: [customer.id, operator.id] } } });
    }
  });
});
