import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, transaction } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));

const { POST } = await import("../apps/web/app/api/ops/artifacts/[id]/review/route");
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };

function request(body: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/ops/artifacts/${id}/review`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("operator qualitative QA boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication and an operator role", async () => {
    getApiUser.mockResolvedValueOnce(null);
    expect((await POST(request({}), context)).status).toBe(401);
    getApiUser.mockResolvedValueOnce({ id, role: "CUSTOMER" });
    expect((await POST(request({}), context)).status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires same origin and a complete explicit decision", async () => {
    getApiUser.mockResolvedValue({ id, role: "OPERATOR" });
    expect(
      (
        await POST(
          request(
            { decision: "PASSED", passedChecks: [], notes: "reviewed output" },
            "https://evil.example",
          ),
          context,
        )
      ).status,
    ).toBe(403);
    expect(
      (await POST(request({ decision: "PASSED", passedChecks: [], notes: "short" }), context))
        .status,
    ).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });
});
