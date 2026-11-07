import {
  normalizeAgentOffer,
  parseAgents,
  parsePricingPlans,
} from "../../../../src/marketplace/normalize";
import type { MarketplaceAdapter, NormalizedService } from "../../../../src/marketplace/types.js";

/** Worker-owned, read-only supplier catalog boundary. Paid methods arrive in M8. */
export class WorkerMarketplaceCatalog implements MarketplaceAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async listServices(filter: { category?: string }): Promise<NormalizedService[]> {
    const query = new URLSearchParams({ sort: "delivered", limit: "20", offset: "0" });
    if (filter.category) query.set("category", filter.category);
    const agents = parseAgents(await this.getJson(`/v1/agents?${query}`));
    const fetchedAt = new Date().toISOString();
    return Promise.all(
      agents.map(async (agent) =>
        normalizeAgentOffer(
          agent,
          parsePricingPlans(await this.getJson(`/v1/agents/${agent.agent_id}/pricing-plans`)),
          fetchedAt,
        ),
      ),
    );
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`Marketplace catalog request failed with HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}
