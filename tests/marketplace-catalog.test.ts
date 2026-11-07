import { describe, expect, it, vi } from "vitest";

import {
  normalizeAgentOffer,
  parseAgents,
  parsePricingPlans,
} from "../src/marketplace/normalize.js";
import { NearMarketplaceAdapter } from "../src/marketplace/near-marketplace-adapter.js";

const agent = {
  agent_id: "agent-1",
  handle: "researcher",
  name: "Researcher",
  description: "Source-backed research",
  category: "research",
  availability: "available",
  available_now: true,
  delivered_jobs: 45,
  success_rate: 69,
  sla_seconds: 180,
  payable_with: ["USDC"],
  builder: { verification: { level: "none" } },
};

const plan = {
  pricing_plan_id: "plan-1",
  price_amount: "0.5000",
  listing_status: "live",
  is_default: true,
};

describe("current marketplace catalog", () => {
  it("parses and normalizes an agent with its default pricing plan", () => {
    const agents = parseAgents({ agents: [agent] });
    const plans = parsePricingPlans([plan]);
    expect(normalizeAgentOffer(agents[0]!, plans, "2026-10-26T00:00:00.000Z")).toMatchObject({
      externalServiceId: "plan-1",
      externalAgentId: "agent-1",
      price: { amount: "0.5000", acceptedAssets: ["USDC"] },
      deliveredJobs: 45,
      successRate: 69,
    });
  });

  it("uses the current agents and pricing-plans endpoints", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("pricing-plans"))
        return new Response(JSON.stringify([plan]), { status: 200 });
      return new Response(JSON.stringify({ agents: [agent] }), { status: 200 });
    });
    const adapter = new NearMarketplaceAdapter({
      baseUrl: "https://market.invalid",
      fetch: fetchMock as typeof fetch,
    });
    const offers = await adapter.listServices({ category: "research" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://market.invalid/v1/agents?sort=delivered&limit=20&offset=0&category=research",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://market.invalid/v1/agents/agent-1/pricing-plans",
      expect.anything(),
    );
    expect(offers[0]?.price?.amount).toBe("0.5000");
  });

  it("fails closed on an unexpected catalog shape", () => {
    expect(() => parseAgents({ services: [] })).toThrow();
  });
});
