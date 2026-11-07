import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, quoteFindFirst, requestFindFirst, transaction } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  quoteFindFirst: vi.fn(),
  requestFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: quoteFindFirst },
    serviceRequest: { findFirst: requestFindFirst },
    $transaction: transaction,
  },
}));

const { POST: acceptQuote } = await import("../apps/web/app/api/quotes/[id]/accept/route.ts");
const { PATCH: increaseBudget } = await import("../apps/web/app/api/requests/[id]/budget/route.ts");

const quoteId = "33333333-3333-4333-8333-333333333333";
const requestId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";

function accept(body: unknown) {
  return acceptQuote(
    new Request(`http://localhost/api/quotes/${quoteId}/accept`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: quoteId }) },
  );
}

function updateBudget(budgetMinor: string) {
  return increaseBudget(
    new Request(`http://localhost/api/requests/${requestId}/budget`, {
      method: "PATCH",
      body: JSON.stringify({ budgetMinor }),
    }),
    { params: Promise.resolve({ id: requestId }) },
  );
}

describe("over-budget quote controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ id: userId });
    quoteFindFirst.mockResolvedValue({
      id: quoteId,
      state: "PRESENTED",
      expiresAt: new Date(Date.now() + 60_000),
      requestId,
      version: 1,
      currency: "USD",
      customerTotalMinor: 18688n,
      request: { budgetMinor: 10000n, budgetCurrency: "USD" },
    });
  });

  it("requires the exact quoted price and explicit over-budget acknowledgement", async () => {
    expect(
      (await accept({ expectedTotalMinor: "10000", acknowledgeOverBudget: true })).status,
    ).toBe(409);
    const response = await accept({ expectedTotalMinor: "18688" });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("OVER_BUDGET_CONFIRMATION_REQUIRED");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("accepts the higher quote only after confirmation and records it", async () => {
    const tx = {
      quote: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      serviceRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (value: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    const response = await accept({ expectedTotalMinor: "18688", acknowledgeOverBudget: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            aboveBudget: true,
            overBudgetAcknowledged: true,
          }),
        }),
      }),
    );
  });

  it("increases the ceiling without altering an existing quote or funding", async () => {
    requestFindFirst.mockResolvedValue({
      state: "QUOTED",
      version: 2,
      budgetMinor: 10000n,
      budgetCurrency: "USD",
      analysisJson: {
        schemaVersion: 1,
        engine: "AUVRA_RULES_V1",
        round: 1,
        category: "general_service",
        categoryLabel: "Custom digital service",
        summary: "Design a logo",
        decision: "SCOPED",
        decisionReason: "Sufficient details",
        questions: [],
        plan: {
          title: "Logo",
          objective: "Design a logo",
          assumptions: ["Customer budget ceiling: USD 100.00."],
          tasks: [
            {
              key: "production",
              title: "Design",
              objective: "Design",
              deliverables: ["Logo"],
              acceptanceCriteria: ["Approved"],
              capabilities: ["design"],
              dependencies: [],
              spendCapMinor: "10000",
            },
          ],
        },
        marketplace: { status: "NOT_CHECKED", note: "No claim" },
        discovery: {
          runId: "44444444-4444-4444-8444-444444444444",
          status: "OVER_BUDGET",
          observedAt: new Date().toISOString(),
          catalogServiceCount: 120,
          eligibleMatchCount: 25,
          missingTaskKeys: [],
          selected: [],
          explanation: "Over budget",
          quoteId,
          quotedTotalMinor: "18688",
          quotedCurrency: "USD",
        },
        generatedAt: new Date().toISOString(),
      },
      project: null,
    });
    const tx = {
      serviceRequest: {
        findFirst: requestFindFirst,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (value: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    const response = await updateBudget("20000");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, rediscover: false });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ budgetMinor: 20000n }),
      }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });
});
