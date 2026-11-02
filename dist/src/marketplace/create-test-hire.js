import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readEnv } from "../config/env.js";
import { authorizePhaseZeroLiveHire } from "./live-hire-guard.js";
import { NearMarketplaceAdapter } from "./near-marketplace-adapter.js";
const env = readEnv();
const authorization = authorizePhaseZeroLiveHire(env);
const config = env.NEAR_MARKET_BASE_URL
    ? { apiKey: env.NEAR_MARKET_API_KEY, baseUrl: env.NEAR_MARKET_BASE_URL }
    : { apiKey: env.NEAR_MARKET_API_KEY };
const adapter = new NearMarketplaceAdapter(config);
const operationId = randomUUID();
const job = await adapter.createHire({
    authorizationId: `phase-0:${operationId}`,
    idempotencyKey: `phase-0:${operationId}`,
    serviceId: authorization.serviceId,
    title: "Auvra Phase 0 research capability test",
    description: "Produce a short, source-backed comparison of two public products. Include source URLs and a limitations section. This is a controlled integration test; do not access private data.",
    budget: { amount: authorization.amount, token: authorization.token },
});
console.log(JSON.stringify({ provider: job.provider, jobId: job.jobId, assignmentId: job.assignmentId, status: job.status }, null, 2));
