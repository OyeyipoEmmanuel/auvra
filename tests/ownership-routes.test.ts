import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, findFirst, findMany } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/rate-limit", () => ({ withinRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { serviceRequest: { findFirst, findMany } },
}));

const listPath = "../apps/web/app/api/requests/route.ts";
const detailPath = "../apps/web/app/api/requests/[id]/route.ts";
const { GET: listRequests } = (await import(listPath)) as { GET: () => Promise<Response> };
const { GET: readRequest } = (await import(detailPath)) as {
  GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
};

describe("request route ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", role: "CUSTOMER" });
  });

  it("always scopes the request list to the signed-in customer", async () => {
    findMany.mockResolvedValue([]);
    const response = await listRequests();
    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: "11111111-1111-4111-8111-111111111111" } }),
    );
  });

  it("does not expose another customer's request by ID", async () => {
    findFirst.mockResolvedValue(null);
    const response = await readRequest(new Request("http://localhost/api/requests/other"), {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }),
    });
    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "22222222-2222-4222-8222-222222222222",
          customerId: "11111111-1111-4111-8111-111111111111",
        },
      }),
    );
  });

  it("rejects access without a session", async () => {
    getApiUser.mockResolvedValue(null);
    const response = await listRequests();
    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});
