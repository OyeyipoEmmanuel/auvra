import { createServer } from "node:http";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { buyerCredentialKey, markBuyerVerified } from "./buyer-oauth-store.js";
import { fundingFromWhoami } from "./buyer-funding.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
if (!process.env.DATABASE_URL || !process.env.NEAR_MARKET_BUYER_ACCOUNT_ID) {
  throw new Error("DATABASE_URL and NEAR_MARKET_BUYER_ACCOUNT_ID are required.");
}

const expectedAccountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey(), (url) => {
  console.log(`AUVRA_AUTH_URL=${url.toString()}`);
  console.log("Approve this connection in your browser. No paid marketplace call will be made.");
});

function waitForCallback() {
  let resolve!: (params: URLSearchParams) => void;
  let reject!: (error: Error) => void;
  const params = new Promise<URLSearchParams>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", provider.redirectUrl);
    if (url.pathname !== "/callback") return void response.writeHead(404).end();
    try {
      provider.verifyCallbackState(url.searchParams);
      if (url.searchParams.has("error") || !url.searchParams.has("code")) {
        throw new Error("OAuth authorization was not completed.");
      }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h1>Auvra buyer connected</h1><p>You may close this tab.</p>");
      resolve(url.searchParams);
    } catch {
      // An old tab may still return to this port. Do not cancel the active flow.
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("This authorization link is stale or incomplete.");
    }
  });
  server.listen(8765, "127.0.0.1");
  const timer = setTimeout(() => reject(new Error("Buyer OAuth timed out.")), 15 * 60_000);
  timer.unref();
  void params.finally(() => clearTimeout(timer)).catch(() => undefined);
  return { server, params };
}

const callback = waitForCallback();
const client = new Client(
  { name: "auvra-buyer-enrollment", version: "0.0.0" },
  { capabilities: {} },
);

try {
  const first = new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
    authProvider: provider,
  });
  try {
    await client.connect(first);
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
    await first.finishAuth(await callback.params);
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
        authProvider: provider,
      }),
    );
  }

  const result = await client.callTool(
    { name: "marketplace__whoami", arguments: {} },
    { timeout: 8_000 },
  );
  if (result.isError || result.content.length !== 1 || result.content[0]?.type !== "text") {
    throw new Error("Buyer identity could not be verified.");
  }
  const body: unknown = JSON.parse(result.content[0].text);
  const usd = fundingFromWhoami(body, expectedAccountId, "USD");
  const usdc = fundingFromWhoami(body, expectedAccountId, "USDC");
  if (!usd || !usdc) {
    await provider.invalidateCredentials("tokens");
    throw new Error("Buyer account or balances did not match the expected account.");
  }
  await provider.bindAccount(expectedAccountId);
  await markBuyerVerified(db, expectedAccountId);
  console.log(
    JSON.stringify({
      connected: true,
      accountId: expectedAccountId,
      usdAvailableMinor: usd.availableMinor.toString(),
      usdcAvailableMinor: usdc.availableMinor.toString(),
      credentials: "encrypted in PostgreSQL; tokens not printed",
    }),
  );
} finally {
  callback.server.close();
  await client.close().catch(() => undefined);
  await db.$disconnect();
}
