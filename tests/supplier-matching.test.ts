import { describe, expect, it } from "vitest";

import { ceilPercent, decimalToMinor, scoreSupplierCandidate } from "../apps/web/lib/supplier-matching.js";

const task = {
  key: "research",
  title: "Collect evidence",
  objective: "Research the market",
  deliverables: ["Brief"],
  acceptanceCriteria: ["Every claim is sourced"],
  capabilities: ["web research"],
  dependencies: [],
};

const service = {
  provider: "near-agent-market" as const,
  externalServiceId: "service-1",
  name: "Web Research",
  category: "research",
  description: "Concise sourced web research with citations.",
  availableNow: true,
  deliveredJobs: 47,
  successRate: 70,
  price: { amount: "0.5000", acceptedAssets: ["USDC"] },
  fetchedAt: new Date().toISOString(),
  raw: {},
};

describe("supplier matching and quote arithmetic", () => {
  it("converts provider decimals conservatively to integer minor units", () => {
    expect(decimalToMinor("0.5000")).toBe(BigInt(50));
    expect(decimalToMinor("1.001")).toBe(BigInt(101));
    expect(decimalToMinor("invalid")).toBeNull();
  });

  it("only marks available, priced, capability-grounded services eligible", () => {
    const candidate = scoreSupplierCandidate(task, service, "observation-1");
    expect(candidate.eligible).toBe(true);
    expect(candidate.priceMinor).toBe(BigInt(50));
    expect(candidate.currency).toBe("USDC");
    expect(candidate.score).toBeGreaterThan(50);

    const unavailable = scoreSupplierCandidate(task, { ...service, availableNow: false }, "observation-2");
    expect(unavailable.eligible).toBe(false);
  });

  it("rounds reserves and fees upward rather than underquoting", () => {
    expect(ceilPercent(BigInt(101), 15)).toBe(BigInt(16));
    expect(ceilPercent(BigInt(116), 25)).toBe(BigInt(29));
  });
});
