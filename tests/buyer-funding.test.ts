import { describe, expect, it, vi } from "vitest";

import { randomBytes } from "node:crypto";

import {
  fundingFromWhoami,
  probeMarketplaceBuyerFunding,
} from "../apps/worker/src/marketplace/buyer-funding";
import {
  decryptBuyerState,
  encryptBuyerState,
} from "../apps/worker/src/marketplace/buyer-oauth-store";

const options = {
  accessToken: "fixture-token",
  expectedAccountId: "expected-buyer",
  asset: "USD" as const,
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

describe("read-only marketplace buyer funding", () => {
  const whoami = {
    account: { account_id: "expected-buyer" },
    balances: { usd: "0.00", usdc: "0.250000", credit_usd: "100.00" },
  };

  it("uses the live MCP whoami shape and excludes credits from both funding rails", () => {
    expect(fundingFromWhoami(whoami, "expected-buyer", "USD")).toMatchObject({
      source: "MARKETPLACE_MCP",
      availableMinor: 0n,
    });
    expect(fundingFromWhoami(whoami, "expected-buyer", "USDC")).toMatchObject({
      source: "MARKETPLACE_MCP",
      availableMinor: 250000n,
    });
    expect(fundingFromWhoami(whoami, "wrong-buyer", "USD")).toBeNull();
    expect(
      fundingFromWhoami({ ...whoami, balances: { usd: "0.000" } }, "expected-buyer", "USD"),
    ).toBeNull();
  });

  it("encrypts OAuth state with authenticated encryption and rejects tampering", () => {
    const key = randomBytes(32);
    const encrypted = encryptBuyerState(
      { tokens: { access_token: "private-fixture-token", token_type: "Bearer" } },
      key,
    );
    expect(encrypted).not.toContain("private-fixture-token");
    expect(decryptBuyerState(encrypted, key).tokens?.access_token).toBe("private-fixture-token");
    expect(() => decryptBuyerState(encrypted, randomBytes(32))).toThrow();
    expect(() => decryptBuyerState(`${encrypted}x`, key)).toThrow();
  });

  it("verifies identity, asset, decimal precision and available balance", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ account: { account_id: "expected-buyer" } }))
      .mockResolvedValueOnce(response({ fiat: { currency: "USD", available: "15.25" } }));
    const result = await probeMarketplaceBuyerFunding({ ...options, fetcher });
    expect(result).toMatchObject({
      source: "MARKETPLACE_API",
      asset: "USD",
      availableMinor: 1525n,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://market.near.ai/v1/me",
      "https://market.near.ai/v1/wallet/balance",
    ]);
    expect(fetcher.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });

  it("rejects a token for the wrong buyer before requesting any balance", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ account: { account_id: "someone-else" } }));
    expect(await probeMarketplaceBuyerFunding({ ...options, fetcher })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reads the USDC rail at six-decimal precision without counting credits", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ account: { account_id: "expected-buyer" } }))
      .mockResolvedValueOnce(
        response({
          crypto: { currency: "USDC", available: "0.250000" },
          fiat: { currency: "USD", available: "99.00" },
          credit_remaining: "10.00",
        }),
      );
    const result = await probeMarketplaceBuyerFunding({ ...options, asset: "USDC", fetcher });
    expect(result).toMatchObject({ asset: "USDC", availableMinor: 250000n });
  });

  it.each([
    { fiat: { currency: "USDC", available: "15.25" } },
    { fiat: { currency: "USD", available: "15.250000" } },
    { fiat: { currency: "USD", available: "-1.00" } },
    { fiat: { currency: "USD", available: 15.25 } },
  ])("rejects malformed or mismatched balances", async (balance) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ account: { account_id: "expected-buyer" } }))
      .mockResolvedValueOnce(response(balance));
    expect(await probeMarketplaceBuyerFunding({ ...options, fetcher })).toBeNull();
  });

  it("fails closed when the provider rejects or times out", async () => {
    const rejected = vi.fn().mockResolvedValue(response({ error: "unauthorized" }, 401));
    expect(await probeMarketplaceBuyerFunding({ ...options, fetcher: rejected })).toBeNull();
    const timedOut = vi.fn().mockRejectedValue(new Error("timeout"));
    expect(await probeMarketplaceBuyerFunding({ ...options, fetcher: timedOut })).toBeNull();
  });
});
