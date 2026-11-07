import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { mcpBody, parseLiveAgentProfile } from "./live-hire-preflight.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
const databaseUrl = process.env.DATABASE_URL;
const accountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
const [projectId, taskKey] = process.argv.slice(2);
if (!databaseUrl || !accountId || !projectId || !taskKey) {
  throw new Error("DATABASE_URL, buyer account/key, project ID, and task key are required.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const client = new Client({ name: "auvra-buyer-proposal", version: "0.0.0" }, { capabilities: {} });
try {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      request: {
        include: {
          quotes: { where: { state: "ACCEPTED" }, orderBy: { version: "desc" }, take: 1 },
          supplierMatches: {
            where: { planTaskKey: taskKey, selectedAt: { not: null } },
            include: { serviceObservation: true },
          },
        },
      },
      tasks: { where: { taskKey } },
    },
  });
  const task = project?.tasks[0];
  const quote = project?.request.quotes[0];
  const observation = project?.request.supplierMatches[0]?.serviceObservation;
  const agentId = observation?.externalAgentId;
  if (!project || !task || !quote || !observation || !agentId)
    throw new Error("No accepted quote and selected task agent.");
  if (task.status !== "READY" || !["PLANNING", "PROCUREMENT"].includes(project.state))
    throw new Error("Project task is not ready.");
  if (!observation.expiresAt || observation.expiresAt <= new Date())
    throw new Error("Supplier observation expired; re-quote first.");
  if (quote.currency !== "USD" || task.budgetCurrency !== "USD")
    throw new Error("Only same-asset USD job proposals are supported.");
  const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
  if (provider.accountId !== accountId || !(await provider.tokens()))
    throw new Error("Buyer connection unavailable.");
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
      authProvider: provider,
      requestInit: { signal: AbortSignal.timeout(15_000) },
    }),
  );
  const profile = parseLiveAgentProfile(
    mcpBody(
      await client.callTool({ name: "marketplace__get_agent", arguments: { agent_id: agentId } }),
    ),
    agentId,
  );
  if (
    !profile ||
    !profile.acceptingWork ||
    profile.currency !== "USD" ||
    profile.requiredRoles.length > 0 ||
    profile.priceMinor > task.budgetMinor
  ) {
    throw new Error("Live agent does not satisfy the quote, task cap, or connected-tool policy.");
  }
  const existing = await db.supplierJob.findFirst({
    where: { taskId: task.id, state: { notIn: ["CANCELLED", "FAILED", "EXPIRED"] } },
  });
  if (existing) throw new Error(`Task already has a proposal or hire: ${existing.id}`);
  const job = await db.$transaction(async (tx) => {
    const created = await tx.supplierJob.create({
      data: {
        projectId,
        taskId: task.id,
        provider: "NEAR_AGENT_MARKET",
        externalServiceId: observation.externalServiceId,
        externalAgentId: agentId,
        currency: "USD",
        authorizedMinor: profile.priceMinor,
        listingSnapshotJson: {
          agentId,
          name: profile.name,
          pageUrl: profile.pageUrl,
          priceMinor: profile.priceMinor.toString(),
          currency: profile.currency,
          slaSeconds: profile.slaSeconds,
          observedAt: new Date().toISOString(),
        },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        eventType: "SUPPLIER_JOB_PROPOSED",
        projectId,
        supplierJobId: created.id,
        metadataJson: { agentId, amountMinor: profile.priceMinor.toString(), currency: "USD" },
      },
    });
    return created;
  });
  console.log(
    JSON.stringify({
      supplierJobId: job.id,
      agentId,
      pageUrl: profile.pageUrl,
      priceMinor: profile.priceMinor.toString(),
      currency: "USD",
      state: "PROPOSED",
      charged: false,
    }),
  );
} finally {
  await client.close().catch(() => undefined);
  await db.$disconnect();
}
