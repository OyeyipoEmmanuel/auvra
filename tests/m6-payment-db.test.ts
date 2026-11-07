import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it, vi } from "vitest";

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

describe.skipIf(!enabled)("M6 verified payment integration", () => {
  it.each([
    { mode: "LIVE", recovery: false },
    { mode: "SANDBOX", recovery: false },
    { mode: "LIVE", recovery: true },
    { mode: "SANDBOX", recovery: true },
  ] as const)(
    "allocates $mode Bachs payment exactly once (recovery: $recovery) and holds disputes",
    async ({ mode, recovery }) => {
      if (!db) throw new Error("Local database required.");
      const {
        createBachsCheckout,
        processBachsCollection,
        processBachsRiskEvent,
        reconcileBachsCheckout,
      } = await import("../apps/web/lib/live-funding");
      const previousKey = process.env.BACHS_API_KEY;
      const previousWebhook = process.env.BACHS_WEBHOOK_SECRET;
      const previousEnabled = process.env.BACHS_USD_ENABLED;
      const previousMode = process.env.AUVRA_RUNTIME_MODE;
      process.env.BACHS_API_KEY = mode === "LIVE" ? "sk_live_fixture" : "sk_sandbox_fixture";
      process.env.BACHS_WEBHOOK_SECRET = "whsec_fixture";
      process.env.BACHS_USD_ENABLED = "true";
      process.env.AUVRA_RUNTIME_MODE = mode === "LIVE" ? "LIVE_MARKET" : "DEMO_SANDBOX";
      const customer = await db.user.create({
        data: { role: "CUSTOMER", email: `m6-fixture-${crypto.randomUUID()}@example.invalid` },
      });
      const analysis = analyzeServiceRequest({
        rawBrief: "Build a landing page for my business.",
        desiredOutcome: "Simple page",
        constraints: [],
        budgetMinor: 100000n,
        budgetCurrency: "USD",
        deadline: new Date(Date.now() + 30 * 86_400_000),
        answers: [
          {
            questionId: "sections_cta",
            question: "Which sections?",
            answer: "Hero, services, testimonials, contact",
            round: 1,
          },
        ],
      });
      if (!analysis.plan) throw new Error("Fixture analysis did not produce a plan.");
      const request = await db.serviceRequest.create({
        data: {
          customerId: customer.id,
          rawBrief: "M6 payment integration fixture",
          state: "APPROVED",
        },
      });
      const quote = await db.quote.create({
        data: {
          requestId: request.id,
          version: 1,
          state: "ACCEPTED",
          currency: "USD",
          decimals: 2,
          customerTotalMinor: 500n,
          supplierCapMinor: 400n,
          executionCostMinor: 400n,
          reserveMinor: 0n,
          feeMinor: 100n,
          estimatedMarginMinor: 100n,
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
        serviceName: "Fixture supplier",
        externalServiceId: `service-${task.key}`,
        priceMinor: "100",
        currency: "USD",
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
                explanation: "Local payment fixture",
                quoteId: quote.id,
              },
            }),
          ),
        },
      });
      let completed = false;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, options?: RequestInit) => ({
          ok: true,
          json: async () =>
            options?.method === "POST"
              ? {
                  checkout_id: "chk_fixture",
                  checkout_url: "https://checkout.bachs.io/c/fixture",
                  status: "open",
                  reference: quote.id,
                }
              : url.includes("/v1/checkout-sessions/")
                ? completed
                  ? {
                      status: "completed",
                      payment_status: "succeeded",
                      checkout_id: "chk_fixture",
                      reference: quote.id,
                      currency: "USD",
                      amount: "5.00",
                      charge: {
                        payment_id: "ch_fixture",
                        checkout_id: "chk_fixture",
                        reference: quote.id,
                        status: "succeeded",
                        currency: "USD",
                        amount: "5.00",
                        amount_paid: "5.00",
                      },
                    }
                  : { status: "open" }
                : {
                    reference: quote.id,
                    payment_id: "ch_fixture",
                    checkout_id: "chk_fixture",
                    status: "succeeded",
                    amount: "5.00",
                    amount_paid: "5.00",
                    currency: "USD",
                  },
        })),
      );
      let projectId: string | undefined;
      let paymentId: string | undefined;
      try {
        expect((await createBachsCheckout(quote.id, customer.id)).kind).toBe("CHECKOUT_READY");
        expect((await createBachsCheckout(quote.id, customer.id)).kind).toBe("CHECKOUT_READY");
        expect((await reconcileBachsCheckout(quote.id, customer.id)).kind).toBe(
          "PAYMENT_NOT_CONFIRMED",
        );
        expect((await reconcileBachsCheckout(quote.id, crypto.randomUUID())).kind).toBe(
          "NOT_FOUND",
        );
        const payment = await db.customerPayment.findUniqueOrThrow({
          where: {
            provider_providerReference: {
              provider: mode === "LIVE" ? "BACHS" : "BACHS_SANDBOX",
              providerReference: quote.id,
            },
          },
        });
        paymentId = payment.id;
        expect(payment.providerCheckoutId).toBe("chk_fixture");
        const testEvent = {
          id: "evt_test_fixture",
          type: "collection.succeeded",
          data: { charge_id: null },
        };
        expect((await processBachsCollection(JSON.stringify(testEvent), testEvent)).kind).toBe(
          "TEST_EVENT",
        );
        expect(await db.project.count({ where: { requestId: request.id } })).toBe(0);
        const body = JSON.stringify({
          id: "evt_fixture",
          type: "collection.succeeded",
          data: {
            reference: quote.id,
            checkout_id: "chk_fixture",
            charge_id: "ch_fixture",
            amount: "5.00",
            currency: "USD",
            status: "SUCCEEDED",
          },
        });
        completed = true;
        const first = recovery
          ? await reconcileBachsCheckout(quote.id, customer.id)
          : await processBachsCollection(body, JSON.parse(body));
        expect(first.kind).toBe("VERIFIED");
        if (first.kind !== "VERIFIED") throw new Error("Payment not verified.");
        projectId = first.projectId;
        expect((await processBachsCollection(body, JSON.parse(body))).kind).toBe(
          recovery ? "ALREADY_VERIFIED" : "REPLAY",
        );
        expect((await reconcileBachsCheckout(quote.id, customer.id)).kind).toBe("ALREADY_VERIFIED");
        expect(await db.project.count({ where: { requestId: request.id } })).toBe(1);
        expect(await db.ledgerTransaction.count({ where: { paymentId: payment.id } })).toBe(2);
        const journals = await db.ledgerTransaction.findMany({
          where: { paymentId: payment.id },
          select: { asset: true },
        });
        expect(
          journals.every((journal) => journal.asset === (mode === "LIVE" ? "USD" : "DEMO_USD")),
        ).toBe(true);
        expect(await db.projectTask.count({ where: { projectId: first.projectId } })).toBe(4);
        expect(
          (await db.customerPayment.findUniqueOrThrow({ where: { id: payment.id } })).state,
        ).toBe("ALLOCATED");
        expect(
          (await db.customerPayment.findUniqueOrThrow({ where: { id: payment.id } })).provider,
        ).toBe(mode === "LIVE" ? "BACHS" : "BACHS_SANDBOX");
        const riskBody = JSON.stringify({
          id: "evt_risk_fixture",
          type: "dispute.created",
          data: { charge_id: "ch_fixture" },
        });
        expect((await processBachsRiskEvent(riskBody, JSON.parse(riskBody))).kind).toBe("HELD");
        expect((await db.project.findUniqueOrThrow({ where: { id: first.projectId } })).state).toBe(
          "BLOCKED",
        );
      } finally {
        vi.unstubAllGlobals();
        if (previousKey === undefined) delete process.env.BACHS_API_KEY;
        else process.env.BACHS_API_KEY = previousKey;
        if (previousWebhook === undefined) delete process.env.BACHS_WEBHOOK_SECRET;
        else process.env.BACHS_WEBHOOK_SECRET = previousWebhook;
        if (previousEnabled === undefined) delete process.env.BACHS_USD_ENABLED;
        else process.env.BACHS_USD_ENABLED = previousEnabled;
        if (previousMode === undefined) delete process.env.AUVRA_RUNTIME_MODE;
        else process.env.AUVRA_RUNTIME_MODE = previousMode;
        if (projectId) {
          const completedProjectId = projectId;
          const journals = await db.ledgerTransaction.findMany({
            where: { projectId: completedProjectId },
            select: { id: true },
          });
          await db.$transaction(async (tx) => {
            await tx.ledgerEntry.deleteMany({
              where: { transactionId: { in: journals.map((journal) => journal.id) } },
            });
            await tx.ledgerTransaction.deleteMany({ where: { projectId: completedProjectId } });
          });
          await db.projectTask.deleteMany({ where: { projectId } });
          await db.auditEvent.deleteMany({ where: { projectId } });
          await db.outboxEvent.deleteMany({ where: { aggregateId: projectId } });
        }
        if (paymentId) {
          await db.providerWebhookEvent.deleteMany({ where: { paymentId } });
          await db.customerPayment.delete({ where: { id: paymentId } });
        }
        if (projectId) await db.project.delete({ where: { id: projectId } });
        await db.quote.delete({ where: { id: quote.id } });
        await db.serviceRequest.delete({ where: { id: request.id } });
        await db.user.delete({ where: { id: customer.id } });
      }
    },
  );
});
