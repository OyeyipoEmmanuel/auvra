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
});
