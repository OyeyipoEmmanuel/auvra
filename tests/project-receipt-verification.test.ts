import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, getNoChargeProjectReceipt, localNoChargeProof, update } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  getNoChargeProjectReceipt: vi.fn(),
  localNoChargeProof: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/project-receipt", () => ({ getNoChargeProjectReceipt, localNoChargeProof }));
vi.mock("@/lib/prisma", () => ({ prisma: { receiptAnchor: { update } } }));

const { POST } = await import("../apps/web/app/api/projects/[id]/receipt/verify/route");
const projectId = "11111111-1111-4111-8111-111111111111";
const referenceHash = "a".repeat(64);
const canonicalRecordHash = "b".repeat(64);

function verify() {
  return POST(
    new Request(`http://localhost/api/projects/${projectId}/receipt/verify`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: projectId }) },
  );
}

function rpcRecord(record: unknown) {
  return {
    ok: true,
    json: async () => ({ result: { result: [...Buffer.from(JSON.stringify(record))] } }),
  };
}

describe("project receipt verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ id: "customer-1" });
    getNoChargeProjectReceipt.mockResolvedValue({
      anchor: {
        id: "anchor-1",
        network: "testnet",
        contractAccount: "receipt.testnet",
        referenceHash,
        canonicalRecordHash,
        confirmedAt: null,
      },
    });
    localNoChargeProof.mockReturnValue({ canonicalRecordHash });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires an authenticated, owned receipt before querying NEAR", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    getApiUser.mockResolvedValueOnce(null);
    expect((await verify()).status).toBe(401);
    getNoChargeProjectReceipt.mockResolvedValueOnce(null);
    expect((await verify()).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not mark a missing or mismatched onchain record as verified", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(rpcRecord(null))
      .mockResolvedValueOnce(
        rpcRecord({ reference_hash: referenceHash, canonical_record_hash: "c".repeat(64) }),
      );
    vi.stubGlobal("fetch", fetch);
    expect((await (await verify()).json()).verified).toBe(false);
    expect((await verify()).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a receipt whose local quote no longer matches its anchor", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    localNoChargeProof.mockReturnValueOnce({ canonicalRecordHash: "d".repeat(64) });
    expect((await verify()).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("confirms only a matching record returned by NEAR testnet", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        rpcRecord({ reference_hash: referenceHash, canonical_record_hash: canonicalRecordHash }),
      );
    vi.stubGlobal("fetch", fetch);
    expect((await (await verify()).json()).verified).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://rpc.testnet.near.org",
      expect.objectContaining({ method: "POST" }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "anchor-1" },
        data: expect.objectContaining({ state: "CONFIRMED" }),
      }),
    );
  });
});
