import { z } from "zod";

import type { NormalizedService } from "./types.js";

const agentSchema = z
  .object({
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
    builder: z
      .object({
        verification: z.object({ level: z.string().nullish() }).nullish(),
      })
      .nullish(),
  })
  .passthrough();

const browseResponseSchema = z.object({ agents: z.array(z.unknown()) });

const pricingPlanSchema = z
  .object({
    pricing_plan_id: z.string().min(1),
    price_amount: z.string().min(1),
    listing_status: z.string(),
    is_default: z.boolean(),
  })
  .passthrough();

export type LiveAgent = z.infer<typeof agentSchema>;
export type LivePricingPlan = z.infer<typeof pricingPlanSchema>;

export function parseAgents(input: unknown): LiveAgent[] {
  const root = browseResponseSchema.parse(input);
  return root.agents.flatMap((candidate) => {
    const parsed = agentSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parsePricingPlans(input: unknown): LivePricingPlan[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((candidate) => {
    const parsed = pricingPlanSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

export function normalizeAgentOffer(
  agent: LiveAgent,
  plans: LivePricingPlan[],
  fetchedAt = new Date().toISOString(),
): NormalizedService {
  const plan =
    plans.find((candidate) => candidate.is_default && candidate.listing_status === "live") ??
    plans.find((candidate) => candidate.listing_status === "live");
  const service: NormalizedService = {
    provider: "near-agent-market",
    externalServiceId: plan?.pricing_plan_id ?? agent.agent_id,
    externalAgentId: agent.agent_id,
    name: agent.name,
    fetchedAt,
    raw: agent,
  };
  if (agent.category) service.category = agent.category;
  if (agent.description) service.description = agent.description;
  if (agent.availability) service.availability = agent.availability;
  if (agent.available_now != null) service.availableNow = agent.available_now;
  if (agent.delivered_jobs != null) service.deliveredJobs = agent.delivered_jobs;
  if (agent.success_rate != null) service.successRate = agent.success_rate;
  if (agent.sla_seconds != null) service.slaSeconds = agent.sla_seconds;
  const verification = agent.builder?.verification?.level;
  if (verification) service.builderVerification = verification;
  if (plan) service.price = { amount: plan.price_amount, acceptedAssets: agent.payable_with };
  return service;
}
