import { normalizeAgentOffer, parseAgents, parsePricingPlans } from "./normalize.js";
export class NearMarketplaceAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    async getJson(path) {
        const fetcher = this.config.fetch ?? fetch;
        const response = await fetcher(`${this.config.baseUrl}${path}`, {
            headers: { Accept: "application/json" },
        });
        if (!response.ok)
            throw new Error(`Marketplace catalog request failed with HTTP ${response.status}`);
        return response.json();
    }
    async listServices(filter) {
        const query = new URLSearchParams({ sort: "delivered", limit: "20", offset: "0" });
        if (filter.category)
            query.set("category", filter.category);
        const agents = parseAgents(await this.getJson(`/v1/agents?${query}`));
        const fetchedAt = new Date().toISOString();
        return Promise.all(agents.map(async (agent) => {
            const plans = parsePricingPlans(await this.getJson(`/v1/agents/${agent.agent_id}/pricing-plans`));
            return normalizeAgentOffer(agent, plans, fetchedAt);
        }));
    }
}
