import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { analyzeServiceRequest } from "../apps/web/lib/manager-analysis";

vi.mock("server-only", () => ({}));

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

async function removeFixture(customerId: string) {
  if (!db) return;
  const requests = await db.serviceRequest.findMany({
    where: { customerId, rawBrief: "Preview fixture" },
    select: { id: true, project: { select: { id: true } } },
  });
  for (const request of requests) {
    const projectId = request.project?.id;
    if (projectId) {
      const journals = await db.ledgerTransaction.findMany({
        where: { projectId },
        select: { id: true },
      });
      await db.$transaction(async (tx) => {
        await tx.ledgerEntry.deleteMany({
          where: { transactionId: { in: journals.map((journal) => journal.id) } },
        });
        await tx.ledgerTransaction.deleteMany({ where: { projectId } });
      });
      await db.auditEvent.deleteMany({ where: { projectId } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: projectId } });
      await db.receiptAnchor.deleteMany({ where: { projectId } });
      await db.projectTask.deleteMany({ where: { projectId } });
      await db.customerPayment.deleteMany({ where: { projectId } });
      await db.project.delete({ where: { id: projectId } });
    }
    await db.customerPayment.deleteMany({ where: { quote: { requestId: request.id } } });
    await db.quote.deleteMany({ where: { requestId: request.id } });
    await db.serviceRequest.delete({ where: { id: request.id } });
  }
  await db.notification.deleteMany({ where: { userId: customerId } });
  await db.user.delete({ where: { id: customerId } });
}

describe.skipIf(!enabled)("no-charge project setup", () => {
  beforeAll(async () => {
    if (!db) return;
    const stale = await db.user.findMany({
      where: {
        email: { startsWith: "preview-", endsWith: "@example.invalid" },
        requests: { some: { rawBrief: "Preview fixture" } },
      },
      select: { id: true },
    });
    for (const customer of stale) await removeFixture(customer.id);
  });

  it.each(["USD", "USDC"])("isolates %s quotes in a demo ledger", async (currency) => {
    if (!db) throw new Error("Local database required.");
    const { fundAcceptedQuoteInSandbox } = await import("../apps/web/lib/sandbox-funding");
    const previousMode = process.env.AUVRA_RUNTIME_MODE;
    const previousWrites = process.env.MARKETPLACE_WRITES_ENABLED;
    process.env.AUVRA_RUNTIME_MODE = "DEMO_SANDBOX";
    process.env.MARKETPLACE_WRITES_ENABLED = "false";

    const customer = await db.user.create({
      data: { role: "CUSTOMER", email: `preview-${crypto.randomUUID()}@example.invalid` },
    });
    try {
      const analysis = analyzeServiceRequest({
        rawBrief: "Build a landing page for my business.",
        desiredOutcome: "A simple page with clear navigation",
        constraints: [],
        budgetMinor: 100000n,
        budgetCurrency: currency,
        deadline: new Date(Date.now() + 30 * 86_400_000),
        answers: [
          {
            questionId: "sections_cta",
            question: "Which sections?",
            answer: "Hero, services, testimonials, and contact",
            round: 1,
          },
        ],
      });
      if (!analysis.plan) throw new Error("Fixture analysis did not produce a plan.");

      const request = await db.serviceRequest.create({
        data: { customerId: customer.id, rawBrief: "Preview fixture", state: "APPROVED" },
      });
      const executionCost = BigInt(analysis.plan.tasks.length * 100);
      const quote = await db.quote.create({
        data: {
          requestId: request.id,
          version: 1,
          state: "ACCEPTED",
          currency,
          decimals: 2,
          customerTotalMinor: executionCost + 50n,
          supplierCapMinor: executionCost + 20n,
          executionCostMinor: executionCost,
          reserveMinor: 20n,
          feeMinor: 30n,
          estimatedMarginMinor: 30n,
          scopeJson: {},
          assumptionsJson: [],
          exclusionsJson: [],
          termsJson: {},
          expiresAt: new Date(Date.now() + 86_400_000),
          acceptedAt: new Date(),
        },
      });
      const selected = analysis.plan.tasks.map((task) => ({
        taskKey: task.key,
        serviceName: "Observed fixture listing",
        externalServiceId: `fixture-${task.key}`,
        priceMinor: "100",
        currency,
        score: 90,
        reasons: ["fixture"],
      }));
      await db.serviceRequest.update({
        where: { id: request.id },
        data: {
          analysisJson: JSON.parse(
            JSON.stringify({
              ...analysis,
              discovery: {
                runId: crypto.randomUUID(),
                status: "READY_FOR_QUOTE",
                observedAt: new Date().toISOString(),
                catalogServiceCount: selected.length,
                eligibleMatchCount: selected.length,
                missingTaskKeys: [],
                selected,
                explanation: "Fixture supplier coverage",
                quoteId: quote.id,
              },
            }),
          ),
        },
      });

      const pending = await db.customerPayment.create({
        data: {
          customerId: customer.id,
          quoteId: quote.id,
          provider: "BACHS_SANDBOX",
          providerReference: `fixture:${quote.id}`,
          state: "PENDING",
          currency,
          amountMinor: quote.customerTotalMinor,
        },
      });
      expect((await fundAcceptedQuoteInSandbox(quote.id, customer.id)).kind).toBe(
        "PAYMENT_IN_PROGRESS",
      );
      await db.customerPayment.update({ where: { id: pending.id }, data: { state: "FAILED" } });

      const result = await fundAcceptedQuoteInSandbox(quote.id, customer.id);
      expect(result.kind).toBe("FUNDED");
      if (result.kind !== "FUNDED") throw new Error("Project was not created.");
      const projectId = result.projectId;
      expect((await fundAcceptedQuoteInSandbox(quote.id, customer.id)).kind).toBe("ALREADY_FUNDED");
      expect((await fundAcceptedQuoteInSandbox(quote.id, crypto.randomUUID())).kind).toBe(
        "NOT_FOUND",
      );
      const payment = await db.customerPayment.findUniqueOrThrow({
        where: { id: result.paymentId },
      });
      expect(payment.currency).toBe(`DEMO_${currency}`);
      expect(payment.provider).toBe("DEMO_SANDBOX");
      const journals = await db.ledgerTransaction.findMany({ where: { projectId } });
      expect(journals).toHaveLength(2);
      expect(journals.every((journal) => journal.asset === `DEMO_${currency}`)).toBe(true);
      const tasks = await db.projectTask.findMany({ where: { projectId } });
      expect(tasks).toHaveLength(analysis.plan.tasks.length);
      expect(
        tasks.every((task) => task.status === "PLANNED" && task.budgetCurrency === currency),
      ).toBe(true);
      expect(await db.supplierJob.count({ where: { projectId } })).toBe(0);
      const receipt = await db.receiptAnchor.findFirstOrThrow({ where: { projectId } });
      expect(receipt.network).toBe("testnet");
      expect(receipt.kind).toBe("PROJECT");
      expect(receipt.state).toBe("PENDING");
      expect(receipt.transactionHash).toBeNull();
    } finally {
      await removeFixture(customer.id);
      if (previousMode === undefined) delete process.env.AUVRA_RUNTIME_MODE;
      else process.env.AUVRA_RUNTIME_MODE = previousMode;
      if (previousWrites === undefined) delete process.env.MARKETPLACE_WRITES_ENABLED;
      else process.env.MARKETPLACE_WRITES_ENABLED = previousWrites;
    }
  });
});
