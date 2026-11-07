import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
if (!process.env.DATABASE_URL || !process.env.NEAR_MARKET_BUYER_ACCOUNT_ID) {
  throw new Error("DATABASE_URL and NEAR_MARKET_BUYER_ACCOUNT_ID are required.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const client = new Client(
  { name: "auvra-marketplace-inspection", version: "0.0.0" },
  { capabilities: {} },
);

try {
  const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
  if (
    provider.accountId !== process.env.NEAR_MARKET_BUYER_ACCOUNT_ID ||
    !(await provider.tokens())
  ) {
    throw new Error("Buyer connection is missing or bound to a different account.");
  }
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
      authProvider: provider,
      requestInit: { signal: AbortSignal.timeout(15_000) },
    }),
  );
  const { tools } = await client.listTools();
  if (process.argv.includes("--metadata")) {
    const identity = await client.callTool({ name: "marketplace__whoami", arguments: {} });
    const body = identity.structuredContent as Record<string, unknown> | undefined;
    console.log(
      JSON.stringify({
        skillUrl: body?.skill_url ?? null,
        serverVersion: body?.server_version ?? null,
      }),
    );
  } else if (process.argv.includes("--selected-agent")) {
    const match = await db.supplierMatch.findFirst({
      where: { selectedAt: { not: null }, serviceObservation: { externalAgentId: { not: null } } },
      orderBy: { selectedAt: "desc" },
      select: { serviceObservation: { select: { externalAgentId: true } } },
    });
    const agentId = match?.serviceObservation.externalAgentId;
    if (!agentId) throw new Error("No selected agent found locally.");
    const profile = await client.callTool({
      name: "marketplace__get_agent",
      arguments: { agent_id: agentId },
    });
    console.log(JSON.stringify({ agentId, profile }, null, 2));
    process.exitCode = profile.isError ? 1 : 0;
  } else {
    console.log(
      JSON.stringify(
        tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
        null,
        2,
      ),
    );
  }
} finally {
  await client.close().catch(() => undefined);
  await db.$disconnect();
}
