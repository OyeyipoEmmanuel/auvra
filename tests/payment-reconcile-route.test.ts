import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, withinRateLimit, reconcileBachsCheckout } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  withinRateLimit: vi.fn(),
  reconcileBachsCheckout: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/rate-limit", () => ({ withinRateLimit }));
vi.mock("@/lib/live-funding", () => ({ reconcileBachsCheckout }));

const { POST } = await import("../apps/web/app/api/quotes/[id]/reconcile/route");
const quoteId = "33333333-3333-4333-8333-333333333333";

function check(id = quoteId) {
  return POST(new Request(`http://localhost/api/quotes/${id}/reconcile`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("payment reconciliation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ id: "customer-1" });
    withinRateLimit.mockResolvedValue(true);
  });

  it("requires authentication and a valid quote identifier", async () => {
    getApiUser.mockResolvedValueOnce(null);
    expect((await check()).status).toBe(401);
    expect((await check("invalid")).status).toBe(404);
    expect(reconcileBachsCheckout).not.toHaveBeenCalled();
  });

  it("rate-limits checks before contacting Bachs", async () => {
    withinRateLimit.mockResolvedValue(false);
    expect((await check()).status).toBe(429);
    expect(reconcileBachsCheckout).not.toHaveBeenCalled();
  });

  it("scopes reconciliation to the signed-in customer and returns the project", async () => {
    reconcileBachsCheckout.mockResolvedValue({ kind: "VERIFIED", projectId: "project-1" });
    const response = await check();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: "VERIFIED", projectId: "project-1" });
    expect(reconcileBachsCheckout).toHaveBeenCalledWith(quoteId, "customer-1");
  });

  it("does not reveal another customer's quote", async () => {
    reconcileBachsCheckout.mockResolvedValue({ kind: "NOT_FOUND" });
    expect((await check()).status).toBe(404);
  });
});
