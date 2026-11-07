import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { apiRateLimit: { upsert } } }));

const modulePath = "../apps/web/lib/rate-limit.ts";
const { withinRateLimit } = (await import(modulePath)) as {
  withinRateLimit: (action: string, userId: string, max: number) => Promise<boolean>;
};

describe("API rate limit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows attempts through the limit and rejects the next atomic count", async () => {
    upsert.mockResolvedValueOnce({ count: 20 }).mockResolvedValueOnce({ count: 21 });
    expect(await withinRateLimit("file-upload-ticket", "user-a", 20)).toBe(true);
    expect(await withinRateLimit("file-upload-ticket", "user-a", 20)).toBe(false);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { count: { increment: 1 } } }),
    );
  });
});
