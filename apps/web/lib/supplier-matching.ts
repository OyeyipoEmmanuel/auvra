import type { NormalizedService } from "./marketplace-catalog";
import type { ManagerTask } from "./manager-analysis";

export type ScoredSupplierCandidate = {
  service: NormalizedService;
  observationId: string;
  eligible: boolean;
  score: number;
  priceMinor: bigint | null;
  currency: string | null;
  reasons: string[];
};

export function scoreSupplierCandidate(
  task: ManagerTask,
  service: NormalizedService,
  observationId: string,
  requiredCurrency: "USD" | "USDC" = "USDC",
): ScoredSupplierCandidate {
  const inferred = inferCapabilities(service);
  const required = task.capabilities.flatMap(capabilityTerms);
  const capabilityMatches = required.filter((term) =>
    inferred.some((value) => value.includes(term) || term.includes(value)),
  );
  const priceMinor = service.price ? decimalToMinor(service.price.amount) : null;
  const observedAt = Date.parse(service.fetchedAt);
  const fresh =
    Number.isFinite(observedAt) &&
    Date.now() - observedAt <= 15 * 60_000 &&
    observedAt - Date.now() <= 60_000;
  const currency = service.price?.acceptedAssets.includes(requiredCurrency)
    ? requiredCurrency
    : null;
  const reasons: string[] = [];
  if (capabilityMatches.length > 0)
    reasons.push(`Capability evidence: ${[...new Set(capabilityMatches)].slice(0, 4).join(", ")}.`);
  else reasons.push("No direct capability evidence for this task.");
  if (service.availableNow === true) reasons.push("Provider reports available now.");
  else reasons.push("Provider is not currently confirmed available.");
  if (!fresh) reasons.push("Catalog observation is stale and must be refreshed.");
  if (priceMinor != null && currency)
    reasons.push(`Observed price: ${formatMinor(priceMinor, currency)}.`);
  else reasons.push(`No compatible ${requiredCurrency} price was observed.`);
  const withinTaskCap =
    priceMinor == null || task.spendCapMinor == null || priceMinor <= BigInt(task.spendCapMinor);
  if (!withinTaskCap) reasons.push("Observed price exceeds this task's planning cap.");
  if (service.deliveredJobs != null)
    reasons.push(`${service.deliveredJobs} delivered jobs observed.`);
  if (service.successRate != null) reasons.push(`${service.successRate}% recorded success rate.`);

  const eligible =
    capabilityMatches.length > 0 &&
    fresh &&
    service.availableNow === true &&
    priceMinor != null &&
    currency != null &&
    withinTaskCap;
  const verificationScore =
    service.builderVerification && service.builderVerification !== "none" ? 10 : 0;
  const score = eligible
    ? Math.min(
        100,
        50 +
          Math.min(25, (service.successRate ?? 0) * 0.25) +
          Math.min(15, (service.deliveredJobs ?? 0) * 0.3) +
          verificationScore,
      )
    : 0;
  return {
    service,
    observationId,
    eligible,
    score: Math.round(score * 100) / 100,
    priceMinor,
    currency,
    reasons,
  };
}

export function inferCapabilities(service: NormalizedService) {
  const text =
    `${service.name} ${service.category ?? ""} ${service.description ?? ""}`.toLowerCase();
  const vocabulary = [
    "research",
    "web research",
    "market research",
    "competitive analysis",
    "business writing",
    "copy",
    "content",
    "figma",
    "design",
    "ui",
    "ux",
    "frontend",
    "website",
    "landing page",
    "code",
    "development",
    "responsive",
    "lighthouse",
    "pagespeed",
    "web qa",
    "deployment",
    "data analysis",
    "data visualization",
    "automation",
    "quality assurance",
    "review",
    "audit",
  ];
  return vocabulary.filter((term) => text.includes(term));
}

export function decimalToMinor(value: string) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const whole = BigInt(match[1]!);
  const fraction = match[2] ?? "";
  const cents = BigInt((fraction.slice(0, 2) || "0").padEnd(2, "0"));
  const remainder = fraction.slice(2);
  return whole * BigInt(100) + cents + (/[1-9]/.test(remainder) ? BigInt(1) : BigInt(0));
}

export function ceilPercent(value: bigint, percent: number) {
  return (value * BigInt(percent) + BigInt(99)) / BigInt(100);
}

export function calculateTaskSupplierCaps(
  tasks: Array<{ taskKey: string; observedPriceMinor: bigint }>,
) {
  const lines = tasks.map(({ taskKey, observedPriceMinor }) => {
    const reserveMinor = ceilPercent(observedPriceMinor, 15);
    return {
      taskKey,
      observedPriceMinor,
      reserveMinor,
      supplierCapMinor: observedPriceMinor + reserveMinor,
    };
  });
  return {
    lines,
    executionCostMinor: lines.reduce((total, line) => total + line.observedPriceMinor, BigInt(0)),
    reserveMinor: lines.reduce((total, line) => total + line.reserveMinor, BigInt(0)),
    supplierCapMinor: lines.reduce((total, line) => total + line.supplierCapMinor, BigInt(0)),
  };
}

function capabilityTerms(capability: string) {
  const normalized = capability.toLowerCase();
  const aliases: Record<string, string[]> = {
    "requirements analysis": ["research", "market research", "business writing", "content"],
    "content strategy": ["content", "copy", "business writing"],
    "web design": ["figma", "design", "ui", "ux"],
    "ui/ux": ["figma", "design", "ui", "ux"],
    "frontend development": ["frontend", "website", "landing page", "code", "development"],
    "responsive web": ["frontend", "website", "responsive", "code"],
    "web qa": ["lighthouse", "pagespeed", "web qa", "quality assurance"],
    deployment: ["deployment", "website", "development"],
    "market research": ["market research", "research"],
    "web research": ["web research", "research"],
    "competitive analysis": ["competitive analysis", "market research", "research"],
    "business writing": ["business writing", "content", "copy"],
    "data analysis": ["data analysis", "research"],
    "data visualization": ["data visualization", "data analysis"],
    "quality assurance": ["quality assurance", "review", "audit"],
  };
  return aliases[normalized] ?? [normalized];
}

function formatMinor(minor: bigint, currency: string) {
  const value = minor.toString().padStart(3, "0");
  return `${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}
