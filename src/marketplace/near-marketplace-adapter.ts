import { normalizeAgentOffer, parseAgents, parsePricingPlans } from "./normalize.js";
import type { MarketplaceAdapter, NormalizedService, ServiceFilter } from "./types.js";

export class NearMarketplaceAdapter implements MarketplaceAdapter {
  constructor(private readonly config: { baseUrl: string; fetch?: typeof fetch }) {}

  private async getJson(path: string): Promise<unknown> {
    const fetcher = this.config.fetch ?? fetch;
    const response = await fetcher(`${this.config.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Marketplace catalog request failed with HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }

  async listServices(filter: ServiceFilter): Promise<NormalizedService[]> {
    const query = new URLSearchParams({ sort: "delivered", limit: "20", offset: "0" });
    if (filter.category) query.set("category", filter.category);
    const agents = parseAgents(await this.getJson(`/v1/agents?${query}`));
    const fetchedAt = new Date().toISOString();
    return Promise.all(agents.map(async (agent) => {
      const plans = parsePricingPlans(await this.getJson(`/v1/agents/${agent.agent_id}/pricing-plans`));
      return normalizeAgentOffer(agent, plans, fetchedAt);
    }));
  }
}
