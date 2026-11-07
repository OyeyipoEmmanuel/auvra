import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { fundingFromWhoami } from "./buyer-funding.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

export type LiveAgentProfile = {
  agentId: string;
  name: string;
  priceMinor: bigint;
  currency: "USD" | "USDC";
  acceptingWork: boolean;
  requiredRoles: string[];
  pageUrl: string;
  slaSeconds: number | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function mcpBody(value: unknown): unknown {
  const result = record(value);
  if (!result || result.isError === true) return null;
  if (record(result.structuredContent)) return result.structuredContent;
  const content = result.content;
  if (!Array.isArray(content) || content.length !== 1) return null;
  const item = record(content[0]);
  if (item?.type !== "text" || typeof item.text !== "string") return null;
  try {
    return JSON.parse(item.text) as unknown;
  } catch {
    return null;
  }
}

export function exactMinor(value: unknown, decimals: number): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(whole!) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0"));
}

/** A fresh profile is evidence, not permission to hire. Asset conversion is never inferred. */
export function parseLiveAgentProfile(
  value: unknown,
  expectedAgentId: string,
): LiveAgentProfile | null {
  const body = record(value);
  if (!body || body.agent_id !== expectedAgentId || typeof body.name !== "string") return null;
  const currency = body.price_token;
  if (currency !== "USD" && currency !== "USDC") return null;
  if (!Array.isArray(body.payable_with) || !body.payable_with.includes(currency)) return null;
  const priceMinor = exactMinor(body.price, currency === "USD" ? 2 : 6);
  if (priceMinor === null || priceMinor <= 0n) return null;
  if (
    !Array.isArray(body.required_roles) ||
    !body.required_roles.every((role) => typeof role === "string")
  )
    return null;
  if (typeof body.page_url !== "string") return null;
  let pageUrl: URL;
  try {
    pageUrl = new URL(body.page_url);
  } catch {
    return null;
  }
  if (pageUrl.protocol !== "https:" || pageUrl.hostname !== "market.near.ai") return null;
  return {
    agentId: expectedAgentId,
    name: body.name,
    priceMinor,
    currency,
    acceptingWork: body.accepting_work === true,
    requiredRoles: body.required_roles as string[],
    pageUrl: pageUrl.toString(),
    slaSeconds:
      Number.isInteger(body.sla_seconds) && Number(body.sla_seconds) > 0
        ? Number(body.sla_seconds)
        : null,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
  const databaseUrl = process.env.DATABASE_URL;
  const accountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
  const projectId = process.argv[2];
  if (!databaseUrl || !accountId || !projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    throw new Error("DATABASE_URL, buyer account/key, and a project UUID are required.");
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const client = new Client(
    { name: "auvra-hire-preflight", version: "0.0.0" },
    { capabilities: {} },
  );
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        request: {
          include: {
            quotes: { where: { state: "ACCEPTED" }, orderBy: { version: "desc" }, take: 1 },
            supplierMatches: {
              where: { selectedAt: { not: null } },
              include: { serviceObservation: true },
            },
          },
        },
        tasks: true,
        payments: true,
      },
    });
    if (!project) throw new Error("Project not found.");
    const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
    if (provider.accountId !== accountId || !(await provider.tokens())) {
      throw new Error("Buyer connection is missing or bound to another account.");
    }
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
        authProvider: provider,
        requestInit: { signal: AbortSignal.timeout(15_000) },
      }),
    );
    const quote = project.request.quotes[0];
    const whoami = mcpBody(await client.callTool({ name: "marketplace__whoami", arguments: {} }));
    const funding =
      quote && (quote.currency === "USD" || quote.currency === "USDC")
        ? fundingFromWhoami(whoami, accountId, quote.currency)
        : null;
    const results = [];
    for (const task of project.tasks) {
      const match = project.request.supplierMatches.find(
        (item) => item.planTaskKey === task.taskKey,
      );
      const observation = match?.serviceObservation;
      const agentId = observation?.externalAgentId;
      const live = agentId
        ? parseLiveAgentProfile(
            mcpBody(
              await client.callTool({
                name: "marketplace__get_agent",
                arguments: { agent_id: agentId },
              }),
            ),
            agentId,
          )
        : null;
      const reasons: string[] = [];
      if (!quote) reasons.push("NO_ACCEPTED_QUOTE");
      if (project.state !== "PLANNING" && project.state !== "PROCUREMENT")
        reasons.push("PROJECT_NOT_READY");
      if (task.status !== "READY") reasons.push("TASK_NOT_READY");
      if (!observation || !live) reasons.push("LIVE_AGENT_UNVERIFIED");
      if (observation?.expiresAt && observation.expiresAt < new Date())
        reasons.push("MATCH_SNAPSHOT_EXPIRED_REQUOTE_REQUIRED");
      if (live && !live.acceptingWork) reasons.push("AGENT_NOT_ACCEPTING_WORK");
      if (live && live.requiredRoles.length > 0)
        reasons.push("AGENT_REQUIRES_CONNECTED_TOOLS_REVIEW");
      if (live && (live.currency !== task.budgetCurrency || live.currency !== quote?.currency))
        reasons.push("ASSET_MISMATCH");
      if (live && live.priceMinor > task.budgetMinor) reasons.push("TASK_CAP_EXCEEDED");
      if (
        !project.payments.some(
          (payment) =>
            payment.provider === "BACHS" &&
            payment.quoteId === quote?.id &&
            payment.currency === quote.currency &&
            payment.amountMinor === quote.customerTotalMinor &&
            payment.verifiedAt &&
            ["VERIFIED", "ALLOCATED", "RECONCILED"].includes(payment.state),
        )
      )
        reasons.push("LIVE_CUSTOMER_PAYMENT_UNVERIFIED");
      if (!funding || !live || funding.availableMinor < live.priceMinor)
        reasons.push("MARKETPLACE_BUYER_FUNDS_INSUFFICIENT");
      results.push({
        taskId: task.id,
        taskKey: task.taskKey,
        agentId: live?.agentId ?? agentId ?? null,
        agentName: live?.name ?? null,
        pageUrl: live?.pageUrl ?? null,
        currency: live?.currency ?? null,
        livePriceMinor: live?.priceMinor.toString() ?? null,
        taskCapMinor: task.budgetMinor.toString(),
        reasons,
        eligibleForApproval: reasons.length === 0,
      });
    }
    console.log(
      JSON.stringify({ projectId, observedAt: new Date().toISOString(), tasks: results }, null, 2),
    );
  } finally {
    await client.close().catch(() => undefined);
    await db.$disconnect();
  }
}

if (process.argv[1]?.includes("live-hire-preflight")) await main();
