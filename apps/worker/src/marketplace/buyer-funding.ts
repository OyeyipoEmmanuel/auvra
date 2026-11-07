import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { PrismaClient } from "@prisma/client";

import type { MarketplaceFundingProof } from "../policy/reserve-spend.js";
import { buyerCredentialKey, markBuyerVerified } from "./buyer-oauth-store.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

type BuyerProbeOptions = {
  accessToken: string;
  expectedAccountId: string;
  asset: "USD" | "USDC";
  fetcher?: typeof fetch;
};

const MARKET_ORIGIN = "https://market.near.ai";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function decimalToMinor(value: unknown, decimals: number): bigint | null {
  if (typeof value !== "string") return null;
  const match = new RegExp(`^(0|[1-9]\\d*)\\.(\\d{${decimals}})$`).exec(value);
  return match ? BigInt(match[1]!) * 10n ** BigInt(decimals) + BigInt(match[2]!) : null;
}

/** Parse the same account-bound `whoami` shape verified against live Agent Market MCP. */
export function fundingFromWhoami(
  value: unknown,
  expectedAccountId: string,
  asset: "USD" | "USDC",
): MarketplaceFundingProof | null {
  const body = record(value);
  const account = record(body?.account);
  const balances = record(body?.balances);
  if (account?.account_id !== expectedAccountId || !balances) return null;
  const availableMinor = decimalToMinor(
    asset === "USD" ? balances.usd : balances.usdc,
    asset === "USD" ? 2 : 6,
  );
  if (availableMinor === null) return null;
  return { source: "MARKETPLACE_MCP", asset, availableMinor, observedAt: new Date() };
}

function whoamiBody(result: {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean | undefined;
}) {
  if (result.isError || result.content.length !== 1) return null;
  const content = result.content[0];
  if (content?.type !== "text" || !content.text) return null;
  try {
    return JSON.parse(content.text) as unknown;
  } catch {
    return null;
  }
}

/** Uses only the read-only MCP tool; OAuth refresh is encrypted and persisted by the provider. */
export async function probeMcpBuyerFunding(
  db: PrismaClient,
  expectedAccountId: string,
  asset: "USD" | "USDC",
): Promise<MarketplaceFundingProof | null> {
  if (!expectedAccountId) return null;
  let client: Client | undefined;
  try {
    const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
    if (provider.accountId !== expectedAccountId || !(await provider.tokens())) return null;
    client = new Client({ name: "auvra-buyer-worker", version: "0.0.0" }, { capabilities: {} });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
        authProvider: provider,
        requestInit: { signal: AbortSignal.timeout(15_000) },
      }),
    );
    const result = await client.callTool(
      { name: "marketplace__whoami", arguments: {} },
      { timeout: 8_000 },
    );
    const proof = fundingFromWhoami(whoamiBody(result), expectedAccountId, asset);
    if (proof) await markBuyerVerified(db, expectedAccountId);
    return proof;
  } catch {
    return null;
  } finally {
    await client?.close().catch(() => undefined);
  }
}

/** Read-only, account-bound marketplace evidence. No cookie or browser balance is trusted. */
export async function probeMarketplaceBuyerFunding({
  accessToken,
  expectedAccountId,
  asset,
  fetcher = fetch,
}: BuyerProbeOptions): Promise<MarketplaceFundingProof | null> {
  if (!accessToken || !expectedAccountId || !["USD", "USDC"].includes(asset)) return null;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  const request = (path: string) =>
    fetcher(`${MARKET_ORIGIN}${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

  try {
    const identityResponse = await request("/v1/me");
    if (!identityResponse.ok) return null;
    const identity = record(await identityResponse.json());
    const account = record(identity?.account);
    if (account?.account_id !== expectedAccountId) return null;

    const balanceResponse = await request("/v1/wallet/balance");
    if (!balanceResponse.ok) return null;
    const balance = record(await balanceResponse.json());
    const rail = record(asset === "USD" ? balance?.fiat : balance?.crypto);
    if (rail?.currency !== asset) return null;
    const availableMinor = decimalToMinor(rail.available, asset === "USD" ? 2 : 6);
    if (availableMinor === null) return null;
    return {
      source: "MARKETPLACE_API",
      asset,
      availableMinor,
      observedAt: new Date(),
    };
  } catch {
    return null;
  }
}

/** Missing credentials leave the procurement gate closed. Never use a customer browser token. */
export function configuredBuyerFundingProbe(db: PrismaClient, asset: string) {
  return () => {
    const expectedAccountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
    if (!expectedAccountId || (asset !== "USD" && asset !== "USDC")) {
      return Promise.resolve(null);
    }
    return probeMcpBuyerFunding(db, expectedAccountId, asset);
  };
}
