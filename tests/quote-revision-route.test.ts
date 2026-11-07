import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, findFirst, transaction, discover, analyze, parse } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  discover: vi.fn(),
  analyze: vi.fn(),
  parse: vi.fn((value: unknown) => value),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/rate-limit", () => ({ withinRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { quote: { findFirst }, $transaction: transaction },
}));
vi.mock("@/lib/manager-analysis", () => ({
  analyzeServiceRequest: analyze,
  managerAnalysisSchema: { parse },
}));
vi.mock("@/lib/supplier-discovery", () => ({ discoverSuppliersAndQuote: discover }));

const routePath = "../apps/web/app/api/quotes/[id]/revise/route.ts";
const { POST } = (await import(routePath)) as {
  POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
};

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const quoteId = "33333333-3333-4333-8333-333333333333";

function revision(change = "Please add a contact form to the landing page.") {
  return POST(
    new Request(`http://localhost/api/quotes/${quoteId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change }),
    }),
    { params: Promise.resolve({ id: quoteId }) },
  );
}

describe("quote scope revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ id: userId });
    findFirst.mockResolvedValue({
      id: quoteId,
      state: "PRESENTED",
      version: 1,
      request: {
        id: requestId,
        state: "QUOTED",
        rawBrief: "Build a landing page for my business.",
        desiredOutcome: null,
        constraintsJson: [],
        budgetMinor: 100000n,
        budgetCurrency: "USD",
        deadline: null,
        answers: [],
        project: null,
      },
    });
    analyze.mockReturnValue({ decision: "SCOPED", plan: { tasks: [] } });
    discover.mockResolvedValue({ kind: "QUOTED" });
  });

  it("scopes lookup to the customer and hides another user's quote", async () => {
    findFirst.mockResolvedValue(null);
    const response = await revision();
    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: quoteId, request: { customerId: userId } } }),
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a funded or non-presented quote before changing state", async () => {
    findFirst.mockResolvedValue({ state: "ACCEPTED", request: { state: "FUNDED" } });
    const response = await revision();
    expect(response.status).toBe(409);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("supersedes the old quote, records the change, and runs a fresh quote", async () => {
    const tx = {
      quote: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      serviceRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      supplierMatch: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
    const response = await revision();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revised: true, requestId, result: "QUOTED" });
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: quoteId, state: "PRESENTED" },
      data: { state: "SUPERSEDED" },
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: requestId, customerId: userId, state: "QUOTED" } }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
    expect(tx.outboxEvent.create).toHaveBeenCalledOnce();
    expect(discover).toHaveBeenCalledWith(requestId, userId);
  });
});
