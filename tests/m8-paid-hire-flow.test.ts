import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callTool: vi.fn(),
  listTools: vi.fn(),
  reserveSupplierSpend: vi.fn(),
  prepareExternalAction: vi.fn(),
  claimExternalAction: vi.fn(),
  recordPaidHire: vi.fn(),
}));

vi.mock("@modelcontextprotocol/client", () => ({
  Client: class {
    connect = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    callTool = mocks.callTool;
    listTools = mocks.listTools;
  },
  StreamableHTTPClientTransport: class {},
}));
vi.mock("../apps/worker/src/marketplace/persistent-oauth-provider.js", () => ({
  PersistentBuyerOAuthProvider: {
    load: vi
      .fn()
      .mockResolvedValue({ accountId: "buyer-1", tokens: vi.fn().mockResolvedValue({}) }),
  },
}));
vi.mock("../apps/worker/src/marketplace/buyer-oauth-store.js", () => ({
  buyerCredentialKey: () => Buffer.alloc(32),
}));
vi.mock("../apps/worker/src/policy/reserve-spend.js", () => ({
  reserveSupplierSpend: mocks.reserveSupplierSpend,
}));
vi.mock("../apps/worker/src/orchestration/external-actions.js", () => ({
  prepareExternalAction: mocks.prepareExternalAction,
  claimExternalAction: mocks.claimExternalAction,
  claimPaidHireReplay: vi.fn(),
}));
vi.mock("../apps/worker/src/marketplace/record-paid-hire.js", () => ({
  recordPaidHire: mocks.recordPaidHire,
}));

import { hireBuyerJob } from "../apps/worker/src/marketplace/prepare-buyer-draft";

const agentId = "d5fc6356-2361-44da-991c-f2a53e565cae";
const supplierJobId = "98a6e462-2dc7-4220-adb1-80e9af623894";
const taskId = "e90075ee-6177-44c4-9b39-00d827db250a";
const marketJobId = "69ba5ea3-a161-4299-8742-b2ea9768a8a6";
const assignmentId = "38e50f7d-ff94-429e-a384-134c81f2a0bb";
const originalEnv = { ...process.env };

function dbFixture(paymentProvider = "BACHS") {
  const supplierJob = {
    id: supplierJobId,
    projectId: "project-1",
    taskId,
    state: "PROPOSED",
    externalServiceId: "service-1",
    externalAgentId: agentId,
    authorizedMinor: 1500n,
    requestHash: null,
    listingSnapshotJson: { agentId, priceMinor: "1500", currency: "USD" },
  };
  const db = {
    project: {
      findUnique: vi.fn().mockResolvedValue({
        state: "PLANNING",
        requestId: "request-1",
        request: {
          rawBrief: "Research my competitors.",
          quotes: [{ id: "quote-1", currency: "USD", customerTotalMinor: 3000n }],
          supplierMatches: [
            {
              serviceObservation: {
                externalAgentId: agentId,
                externalServiceId: "service-1",
                expiresAt: new Date(Date.now() + 60_000),
              },
            },
          ],
        },
        tasks: [
          {
            id: taskId,
            title: "Research requirements",
            objective: "Summarize the market and competitors.",
            status: "READY",
            budgetCurrency: "USD",
            budgetMinor: 2000n,
          },
        ],
        payments: [
          {
            provider: paymentProvider,
            quoteId: "quote-1",
            currency: "USD",
            amountMinor: 3000n,
            verifiedAt: new Date(),
            state: "VERIFIED",
          },
        ],
      }),
    },
    auditEvent: {
      findFirst: vi.fn().mockResolvedValue({ metadataJson: { externalAgentConsent: true } }),
    },
    supplierJob: {
      findFirst: vi.fn().mockResolvedValue(supplierJob),
      update: vi.fn().mockResolvedValue(supplierJob),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    externalAction: {
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return db as unknown as PrismaClient;
}

describe("paid marketplace hire flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    process.env.MARKETPLACE_WRITES_ENABLED = "true";
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "true";
    process.env.NEAR_MARKET_BUYER_ACCOUNT_ID = "buyer-1";
    process.env.MARKETPLACE_MAX_SPEND_MINOR = "2000";
    mocks.listTools.mockResolvedValue({ tools: [{ name: "marketplace__create_job" }] });
    mocks.callTool.mockImplementation(({ name }: { name: string }) => {
      const body =
        name === "marketplace__get_agent"
          ? {
              agent_id: agentId,
              name: "Research agent",
              price_token: "USD",
              price: "15.00",
              payable_with: ["USD"],
              required_roles: [],
              accepting_work: true,
              page_url: "https://market.near.ai/a/research-agent",
            }
          : {
              job_id: marketJobId,
              assignment_id: assignmentId,
              price: { amount: "15.00", token: "USD" },
            };
      return { content: [{ type: "text", text: JSON.stringify(body) }] };
    });
    mocks.reserveSupplierSpend.mockResolvedValue({ kind: "RESERVED" });
    mocks.prepareExternalAction.mockResolvedValue({ kind: "PREPARED" });
    mocks.claimExternalAction.mockResolvedValue("CLAIMED");
    mocks.recordPaidHire.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("hires the selected agent once using its persistent request ID", async () => {
    const db = dbFixture();
    const outcome = await hireBuyerJob(db, "project-1", "requirements", undefined, true);
    expect(outcome).toEqual({
      supplierJobId,
      externalJobId: marketJobId,
      charged: true,
    });
    const paidCalls = mocks.callTool.mock.calls.filter(
      ([input]) => input.name === "marketplace__create_job",
    );
    expect(paidCalls).toHaveLength(1);
    expect(paidCalls[0]?.[0].arguments).toMatchObject({
      worker_agent_id: agentId,
      client_request_id: supplierJobId,
      token: "USD",
    });
    expect(mocks.recordPaidHire).toHaveBeenCalledOnce();
  });

  it("makes no marketplace call for a sandbox payment", async () => {
    await expect(
      hireBuyerJob(dbFixture("BACHS_SANDBOX"), "project-1", "requirements", undefined, true),
    ).rejects.toThrow("Verified live customer payment is missing");
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("parks a mismatched charge response for reconciliation", async () => {
    const db = dbFixture();
    mocks.callTool.mockImplementation(({ name }: { name: string }) => {
      const body =
        name === "marketplace__get_agent"
          ? {
              agent_id: agentId,
              name: "Research agent",
              price_token: "USD",
              price: "15.00",
              payable_with: ["USD"],
              required_roles: [],
              accepting_work: true,
              page_url: "https://market.near.ai/a/research-agent",
            }
          : {
              job_id: marketJobId,
              assignment_id: assignmentId,
              price: { amount: "20.00", token: "USD" },
            };
      return { content: [{ type: "text", text: JSON.stringify(body) }] };
    });
    await expect(hireBuyerJob(db, "project-1", "requirements", undefined, true)).rejects.toThrow(
      "Paid hire outcome is uncertain",
    );
    expect(mocks.recordPaidHire).not.toHaveBeenCalled();
    expect(db.externalAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: "UNKNOWN" }) }),
    );
  });
});
