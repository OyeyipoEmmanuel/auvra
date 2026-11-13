import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, transaction, createPolicyRecord, createAudit } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  transaction: vi.fn(),
  createPolicyRecord: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));

const { POST } = await import("../apps/web/app/api/ops/policies/create/route");
const previousMode = process.env.AUVRA_RUNTIME_MODE;

function request(body: unknown) {
  return new Request("http://localhost:3000/api/ops/policies/create", {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const valid = {
  confirmed: true,
  serviceIds: ["service-1"],
  perJobCapMinor: "1500",
  projectCapMinor: "5000",
  dailyCapMinor: "10000",
  contributionFloorMinor: "0",
  reason: "Initial small live supplier pilot",
};

describe("initial live procurement policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    getApiUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    createPolicyRecord.mockResolvedValue({ id: "policy-1", version: 1 });
    transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: vi.fn().mockResolvedValue([]),
        policyVersion: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          create: createPolicyRecord,
        },
        supplierJob: { findMany: vi.fn().mockResolvedValue([{ externalServiceId: "service-1" }]) },
        auditEvent: { create: createAudit },
      }),
    );
  });

  it("creates a USD-only policy paused by default", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ policyId: "policy-1", version: 1, paused: true });
    expect(createPolicyRecord).toHaveBeenCalledWith({
      data: expect.objectContaining({
        active: true,
        createdById: "admin-1",
        rulesJson: expect.objectContaining({
          paused: true,
          allowedCurrencies: ["USD"],
          allowedServices: ["service-1"],
          perJobCapMinor: "1500",
          firstLiveHireRequiresApproval: true,
        }),
      }),
    });
    expect(createAudit).toHaveBeenCalled();
  });

  it("rejects contradictory caps before touching the database", async () => {
    const response = await POST(request({ ...valid, projectCapMinor: "1000" }));
    expect(response.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  afterAll(() => {
    if (previousMode === undefined) delete process.env.AUVRA_RUNTIME_MODE;
    else process.env.AUVRA_RUNTIME_MODE = previousMode;
  });
});
