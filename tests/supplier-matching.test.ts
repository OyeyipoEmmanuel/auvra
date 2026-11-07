import { describe, expect, it } from "vitest";

import {
  calculateTaskSupplierCaps,
  ceilPercent,
  decimalToMinor,
  scoreSupplierCandidate,
} from "../apps/web/lib/supplier-matching.js";

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

    const unavailable = scoreSupplierCandidate(
      task,
      { ...service, availableNow: false },
      "observation-2",
    );
    expect(unavailable.eligible).toBe(false);

    const overTaskCap = scoreSupplierCandidate(
      { ...task, spendCapMinor: "49" },
      service,
      "observation-3",
    );
    expect(overTaskCap.eligible).toBe(false);
    expect(overTaskCap.reasons).toContain("Observed price exceeds this task's planning cap.");

    const stale = scoreSupplierCandidate(
      task,
      { ...service, fetchedAt: new Date(Date.now() - 20 * 60_000).toISOString() },
      "observation-4",
    );
    expect(stale.eligible).toBe(false);
    expect(stale.reasons).toContain("Catalog observation is stale and must be refreshed.");

    const unsupportedAsset = scoreSupplierCandidate(
      task,
      { ...service, price: { amount: "0.5000", acceptedAssets: ["NEAR"] } },
      "observation-5",
    );
    expect(unsupportedAsset.eligible).toBe(false);
  });

  it("requires the selected supplier to accept the live quote asset", () => {
    expect(scoreSupplierCandidate(task, service, "usdc-only", "USD").eligible).toBe(false);
    const dualAsset = { ...service, price: { amount: "0.50", acceptedAssets: ["USD", "USDC"] } };
    const usd = scoreSupplierCandidate(task, dualAsset, "dual-asset", "USD");
    expect(usd.eligible).toBe(true);
    expect(usd.currency).toBe("USD");
  });

  it("rounds reserves and fees upward rather than underquoting", () => {
    expect(ceilPercent(BigInt(101), 15)).toBe(BigInt(16));
    expect(ceilPercent(BigInt(116), 25)).toBe(BigInt(29));
  });

  it("makes the project supplier cap equal the sum of enforceable task caps", () => {
    const budget = calculateTaskSupplierCaps([
      { taskKey: "research", observedPriceMinor: 101n },
      { taskKey: "design", observedPriceMinor: 50n },
    ]);
    expect(budget.lines.map((line) => line.supplierCapMinor)).toEqual([117n, 58n]);
    expect(budget.executionCostMinor).toBe(151n);
    expect(budget.reserveMinor).toBe(24n);
    expect(budget.supplierCapMinor).toBe(175n);
  });
});
