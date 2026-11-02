import "server-only";

import { z } from "zod";

export type NormalizedService = {
  provider: "near-agent-market";
  externalServiceId: string;
  externalAgentId?: string | undefined;
  name: string;
  category?: string | undefined;
  description?: string | undefined;
  price?: { amount: string; acceptedAssets: string[] } | undefined;
  availability?: string | undefined;
  availableNow?: boolean | undefined;
  deliveredJobs?: number | undefined;
  successRate?: number | undefined;
  slaSeconds?: number | undefined;
  builderVerification?: string | undefined;
  fetchedAt: string;
};

const agentSchema = z.object({
  agent_id: z.string().min(1),
  handle: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  category: z.string().nullish(),
  availability: z.string().nullish(),
  available_now: z.boolean().nullish(),
  delivered_jobs: z.number().int().nonnegative().nullish(),
  success_rate: z.number().nonnegative().nullish(),
  sla_seconds: z.number().int().nonnegative().nullish(),
  payable_with: z.array(z.string()).default([]),
  builder: z.object({ verification: z.object({ level: z.string().nullish() }).nullish() }).nullish(),
}).passthrough();

const browseSchema = z.object({ agents: z.array(z.unknown()) });
const pricingSchema = z.object({ pricing_plan_id: z.string().min(1), price_amount: z.string().min(1), listing_status: z.string(), is_default: z.boolean() }).passthrough();

export class NearMarketplaceCatalog {
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

  async listServices(category: string): Promise<NormalizedService[]> {
    const query = new URLSearchParams({ sort: "delivered", limit: "20", offset: "0", category });
    const root = browseSchema.parse(await this.getJson(`/v1/agents?${query}`));
    const agents = root.agents.flatMap((candidate) => {
      const parsed = agentSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : [];
    });
    const fetchedAt = new Date().toISOString();
    return Promise.all(agents.map(async (agent) => {
      const pricingRaw = await this.getJson(`/v1/agents/${agent.agent_id}/pricing-plans`);
      const plans = Array.isArray(pricingRaw) ? pricingRaw.flatMap((candidate) => {
        const parsed = pricingSchema.safeParse(candidate);
        return parsed.success ? [parsed.data] : [];
      }) : [];
      const plan = plans.find((candidate) => candidate.is_default && candidate.listing_status === "live") ?? plans.find((candidate) => candidate.listing_status === "live");
      return compact({
        provider: "near-agent-market" as const,
        externalServiceId: plan?.pricing_plan_id ?? agent.agent_id,
        externalAgentId: agent.agent_id,
        name: agent.name,
        category: agent.category ?? undefined,
        description: agent.description ?? undefined,
        price: plan ? { amount: plan.price_amount, acceptedAssets: agent.payable_with } : undefined,
        availability: agent.availability ?? undefined,
        availableNow: agent.available_now ?? undefined,
        deliveredJobs: agent.delivered_jobs ?? undefined,
        successRate: agent.success_rate ?? undefined,
        slaSeconds: agent.sla_seconds ?? undefined,
        builderVerification: agent.builder?.verification?.level ?? undefined,
        fetchedAt,
      });
    }));
  }

  private async getJson(path: string) {
    const response = await this.fetcher(`${this.baseUrl}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Marketplace catalog request failed with HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
