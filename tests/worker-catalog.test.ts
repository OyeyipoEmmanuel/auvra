import { describe, expect, it, vi } from "vitest";

const catalogPath = ["../apps/worker", "src/marketplace/catalog.ts"].join("/");
const { WorkerMarketplaceCatalog } = (await import(catalogPath)) as {
  WorkerMarketplaceCatalog: new (
    baseUrl: string,
    fetcher: typeof fetch,
  ) => {
    listServices: (filter: { category?: string }) => Promise<Array<{ externalServiceId: string }>>;
  };
};

describe("worker-owned marketplace catalog", () => {
  it("loads the shared normalizer and reads the catalog without paid actions", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("pricing-plans")) {
        return new Response(
          JSON.stringify([
            {
              pricing_plan_id: "plan-1",
              price_amount: "0.5000",
              listing_status: "live",
              is_default: true,
            },
          ]),
        );
      }
      return new Response(
        JSON.stringify({
          agents: [
            {
              agent_id: "agent-1",
              handle: "researcher",
              name: "Researcher",
              category: "research",
              available_now: true,
              payable_with: ["USDC"],
            },
          ],
        }),
      );
    });
    const catalog = new WorkerMarketplaceCatalog("https://market.invalid", fetcher as typeof fetch);
    const services = await catalog.listServices({ category: "research" });
    expect(services[0]?.externalServiceId).toBe("plan-1");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries a temporary catalog connection failure", async () => {
    let catalogAttempts = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("pricing-plans")) return new Response(JSON.stringify([]));
      catalogAttempts += 1;
      if (catalogAttempts === 1) throw new TypeError("fetch failed");
      return new Response(
        JSON.stringify({ agents: [{ agent_id: "agent-1", handle: "one", name: "One" }] }),
      );
    });
    const catalog = new WorkerMarketplaceCatalog("https://market.invalid", fetcher as typeof fetch);
    await catalog.listServices({ category: "research" });
    expect(catalogAttempts).toBe(2);
  });

  it("keeps priced agents when one listing cannot be checked", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("agent-b/pricing-plans")) return new Response(null, { status: 404 });
      if (url.includes("agent-a/pricing-plans")) {
        return new Response(
          JSON.stringify([
            {
              pricing_plan_id: "plan-a",
              price_amount: "2",
              listing_status: "live",
              is_default: true,
            },
          ]),
        );
      }
      return new Response(
        JSON.stringify({
          agents: [
            { agent_id: "agent-a", handle: "a", name: "A", category: "research" },
            { agent_id: "agent-b", handle: "b", name: "B", category: "research" },
          ],
        }),
      );
    });
    const catalog = new WorkerMarketplaceCatalog("https://market.invalid", fetcher as typeof fetch);
    const services = await catalog.listServices({ category: "research" });
    expect(services).toHaveLength(1);
    expect(services[0]?.externalServiceId).toBe("plan-a");
  });

  it("retries a temporary marketplace error", async () => {
    let catalogAttempts = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("pricing-plans")) return new Response(JSON.stringify([]));
      catalogAttempts += 1;
      if (catalogAttempts === 1) return new Response(null, { status: 503 });
      return new Response(
        JSON.stringify({ agents: [{ agent_id: "agent-1", handle: "one", name: "One" }] }),
      );
    });
    const catalog = new WorkerMarketplaceCatalog("https://market.invalid", fetcher as typeof fetch);
    await catalog.listServices({ category: "research" });
    expect(catalogAttempts).toBe(2);
  });

  it("fails discovery if every listing price lookup fails", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("pricing-plans")
        ? new Response(null, { status: 404 })
        : new Response(
            JSON.stringify({
              agents: [{ agent_id: "agent-1", handle: "one", name: "One" }],
            }),
          ),
    );
    const catalog = new WorkerMarketplaceCatalog("https://market.invalid", fetcher as typeof fetch);
    await expect(catalog.listServices({ category: "research" })).rejects.toThrow("HTTP 404");
  });
});
