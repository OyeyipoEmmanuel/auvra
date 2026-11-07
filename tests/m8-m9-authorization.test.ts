import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApiUser, transaction, projectFindFirst, queryRaw, supplierFindUnique } = vi.hoisted(
  () => ({
    getApiUser: vi.fn(),
    transaction: vi.fn(),
    projectFindFirst: vi.fn(),
    queryRaw: vi.fn(),
    supplierFindUnique: vi.fn(),
  }),
);

vi.mock("@/lib/authz", () => ({ getApiUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    project: { findFirst: projectFindFirst },
    supplierJob: { findUnique: supplierFindUnique },
  },
}));

const { POST: approve } = await import("../apps/web/app/api/ops/supplier-jobs/[id]/approve/route");
const { POST: accept } = await import("../apps/web/app/api/projects/[id]/accept-delivery/route");
const jobId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const artifactId = "33333333-3333-4333-8333-333333333333";

function post(path: string, body: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

describe("M8 operator and M9 customer command boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: queryRaw,
        project: { findFirst: projectFindFirst },
      }),
    );
    queryRaw.mockResolvedValue([]);
    projectFindFirst.mockResolvedValue(null);
  });

  it("rejects an unauthenticated or customer-role supplier approval", async () => {
    getApiUser.mockResolvedValueOnce(null);
    expect(
      (
        await approve(post(`/api/ops/supplier-jobs/${jobId}/approve`, {}), {
          params: Promise.resolve({ id: jobId }),
        })
      ).status,
    ).toBe(401);
    getApiUser.mockResolvedValueOnce({ id: projectId, role: "CUSTOMER" });
    expect(
      (
        await approve(post(`/api/ops/supplier-jobs/${jobId}/approve`, {}), {
          params: Promise.resolve({ id: jobId }),
        })
      ).status,
    ).toBe(403);
    expect(supplierFindUnique).not.toHaveBeenCalled();
  });

  it("requires same-origin, explicit customer delivery acceptance", async () => {
    getApiUser.mockResolvedValue({ id: jobId, role: "CUSTOMER" });
    const context = { params: Promise.resolve({ id: projectId }) };
    expect(
      (
        await accept(
          post(
            `/api/projects/${projectId}/accept-delivery`,
            { artifactIds: [artifactId], confirmed: true },
            "https://evil.example",
          ),
          context,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await accept(
          post(`/api/projects/${projectId}/accept-delivery`, { artifactIds: [artifactId] }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("scopes the delivery command to the signed-in project owner", async () => {
    getApiUser.mockResolvedValue({ id: jobId, role: "CUSTOMER" });
    const response = await accept(
      post(`/api/projects/${projectId}/accept-delivery`, {
        artifactIds: [artifactId],
        confirmed: true,
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(response.status).toBe(404);
    expect(projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: projectId, customerId: jobId } }),
    );
  });
});
