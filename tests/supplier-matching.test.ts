import { describe, expect, it } from "vitest";

import {
  calculateTaskSupplierCaps,
  ceilPercent,
  decimalToMinor,
  inferCapabilities,
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

  it("does not mistake code review for landing-page implementation", () => {
    const implementation = {
      ...task,
      key: "implementation",
      title: "Build the landing page",
      capabilities: ["frontend development", "responsive web"],
    };
    const review = {
      ...service,
      name: "GitHub PR Review",
      category: "dev_tools",
      description: "Send a GitHub PR for code review and security findings.",
    };
    const candidate = scoreSupplierCandidate(implementation, review, "review-only");
    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain(
      "This listing does not show the work required for this task.",
    );

    const builder = {
      ...service,
      name: "Landing Page Designer",
      category: "marketing",
      description: "A landing page from strategy and copy to a ready-to-publish HTML page.",
    };
    expect(scoreSupplierCandidate(implementation, builder, "page-builder").eligible).toBe(true);
  });

  it("requires web-specific validation evidence for page QA", () => {
    const qa = {
      ...task,
      key: "qa_delivery",
      title: "Validate and package delivery",
      capabilities: ["web QA", "deployment"],
    };
    const review = {
      ...service,
      name: "GitHub PR Review",
      category: "dev_tools",
      description: "Code review and security findings for GitHub pull requests.",
    };
    expect(scoreSupplierCandidate(qa, review, "generic-review").eligible).toBe(false);
    const seoAudit = {
      ...service,
      name: "Website SEO Audit",
      category: "marketing",
      description: "Audit search rankings and metadata for a website.",
    };
    expect(scoreSupplierCandidate(qa, seoAudit, "seo-only").eligible).toBe(false);
    const webQa = {
      ...service,
      name: "Website QA",
      category: "dev_tools",
      description: "Test responsive landing pages, run Lighthouse, and report issues.",
    };
    expect(scoreSupplierCandidate(qa, webQa, "web-qa").eligible).toBe(true);
    expect(
      inferCapabilities({ ...service, name: "Guide", description: "General advice" }),
    ).not.toContain("ui");
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
