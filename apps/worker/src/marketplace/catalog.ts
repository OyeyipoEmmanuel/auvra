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
    const services: NormalizedService[] = [];
    let firstFailure: unknown;
    for (let index = 0; index < agents.length; index += 10) {
      const batch = await Promise.allSettled(
        agents
          .slice(index, index + 10)
          .map(async (agent) =>
            normalizeAgentOffer(
              agent,
              parsePricingPlans(await this.getJson(`/v1/agents/${agent.agent_id}/pricing-plans`)),
              fetchedAt,
            ),
          ),
      );
      for (const result of batch) {
        if (result.status === "fulfilled") services.push(result.value);
        else firstFailure ??= result.reason;
      }
    }
    if (agents.length > 0 && services.length === 0 && firstFailure) throw firstFailure;
    return services;
  }

  private async getJson(path: string): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        if (response.ok) return response.json() as Promise<unknown>;
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
          throw new Error(`Marketplace catalog request failed with HTTP ${response.status}`);
        }
      } catch (error) {
        if (attempt === 2 || (error instanceof Error && error.message.includes("HTTP "))) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    throw new Error("Marketplace catalog request could not be completed.");
  }
}
