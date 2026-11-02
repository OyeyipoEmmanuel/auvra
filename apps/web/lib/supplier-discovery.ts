import "server-only";

import type { Prisma } from "@prisma/client";

import { NearMarketplaceCatalog, type NormalizedService } from "@/lib/marketplace-catalog";
import { isManagerAnalysis, type ManagerAnalysis } from "@/lib/manager-analysis";
import { prisma } from "@/lib/prisma";
import { ceilPercent, inferCapabilities, scoreSupplierCandidate, type ScoredSupplierCandidate } from "@/lib/supplier-matching";

const catalogCategories = ["research", "creative", "dev_tools", "marketing", "data", "automation"];

export async function discoverSuppliersAndQuote(requestId: string, customerId: string) {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, customerId },
    select: {
      id: true,
      state: true,
      analysisJson: true,
      budgetMinor: true,
      budgetCurrency: true,
      deadline: true,
      quotes: { orderBy: { version: "desc" }, take: 1, select: { version: true } },
    },
  });
  if (!request) return { kind: "NOT_FOUND" as const };
  if (request.state === "QUOTED") {
    const quote = await prisma.quote.findFirst({ where: { requestId, state: "PRESENTED" }, orderBy: { version: "desc" } });
    return { kind: "QUOTED" as const, quoteId: quote?.id ?? null };
  }
  if (request.state !== "SCOPED") {
    return { kind: "INVALID_STATE" as const, state: request.state };
  }
  const candidateAnalysis = request.analysisJson;
  if (!isManagerAnalysis(candidateAnalysis)) {
    return { kind: "INVALID_STATE" as const, state: request.state };
  }
  const plan = candidateAnalysis.plan;
  if (!plan) return { kind: "INVALID_STATE" as const, state: request.state };
  const analysis = candidateAnalysis;
  const runId = crypto.randomUUID();
  const adapter = new NearMarketplaceCatalog((process.env.NEAR_MARKET_BASE_URL ?? "https://market.near.ai").replace(/\/$/, ""));
  const categoryResults = await Promise.all(catalogCategories.map((category) => adapter.listServices(category)));
  const services = deduplicateServices(categoryResults.flat());
  const observedAt = new Date();

  const observations = new Map<string, string>();
  for (const service of services) {
    const observation = await prisma.supplierServiceObservation.create({
      data: {
        provider: service.provider,
        externalServiceId: service.externalServiceId,
        externalAgentId: service.externalAgentId,
        name: service.name,
        category: service.category,
        capabilitiesJson: toJson({ inferred: inferCapabilities(service), description: service.description ?? null }),
        pricingJson: toJson(service.price ?? { unavailable: true }),
        availabilityJson: toJson({ status: service.availability ?? null, availableNow: service.availableNow ?? null, deliveredJobs: service.deliveredJobs ?? null, successRate: service.successRate ?? null, slaSeconds: service.slaSeconds ?? null, builderVerification: service.builderVerification ?? null }),
        rawReference: `near-agent-market:${service.externalAgentId ?? service.externalServiceId}`,
        observedAt,
        expiresAt: new Date(observedAt.getTime() + 15 * 60 * 1000),
      },
      select: { id: true },
    });
    observations.set(service.externalServiceId, observation.id);
  }

  const matchesByTask = new Map<string, ScoredSupplierCandidate[]>();
  for (const task of plan.tasks) {
    const candidates = services.map((service) => scoreSupplierCandidate(task, service, observations.get(service.externalServiceId)!));
    matchesByTask.set(task.key, candidates);
    await prisma.supplierMatch.createMany({
      data: candidates.map((candidate) => ({
        requestId,
        planTaskKey: task.key,
        serviceObservationId: candidate.observationId,
        eligible: candidate.eligible,
        score: candidate.score,
        reasonsJson: candidate.reasons,
      })),
      skipDuplicates: true,
    });
  }

  const selected = plan.tasks.flatMap((task) => {
    const best = matchesByTask.get(task.key)?.filter((candidate) => candidate.eligible).sort((a, b) => b.score - a.score)[0];
    return best ? [{ task, candidate: best }] : [];
  });
  const missingTaskKeys = plan.tasks.filter((task) => !selected.some((choice) => choice.task.key === task.key)).map((task) => task.key);

  await Promise.all(selected.map(({ task, candidate }) => prisma.supplierMatch.update({
    where: { requestId_planTaskKey_serviceObservationId: { requestId, planTaskKey: task.key, serviceObservationId: candidate.observationId } },
    data: { selectedAt: observedAt },
  })));

  const selectedSummary = selected.map(({ task, candidate }) => ({
    taskKey: task.key,
    serviceName: candidate.service.name,
    externalServiceId: candidate.service.externalServiceId,
    priceMinor: candidate.priceMinor!.toString(),
    currency: candidate.currency!,
    score: candidate.score,
    reasons: candidate.reasons,
  }));
  const eligibleMatchCount = [...matchesByTask.values()].reduce((count, candidates) => count + candidates.filter((candidate) => candidate.eligible).length, 0);

  if (missingTaskKeys.length > 0) {
    const discovery: NonNullable<ManagerAnalysis["discovery"]> = {
      runId,
      status: "NOT_AVAILABLE",
      observedAt: observedAt.toISOString(),
      catalogServiceCount: services.length,
      eligibleMatchCount,
      missingTaskKeys,
      selected: selectedSummary,
      explanation: "The current live catalog does not contain a verified, available, priced supplier for every required task. Auvra will not present an executable quote with missing coverage.",
    };
    await saveDiscoveryOnly(requestId, customerId, analysis, discovery);
    return { kind: "NOT_AVAILABLE" as const, discovery };
  }

  const executionCostMinor = selected.reduce((total, choice) => total + choice.candidate.priceMinor!, BigInt(0));
  const reserveMinor = ceilPercent(executionCostMinor, 15);
  const feeMinor = ceilPercent(executionCostMinor + reserveMinor, 25);
  const customerTotalMinor = executionCostMinor + reserveMinor + feeMinor;
  const comparableBudget = request.budgetMinor && (request.budgetCurrency === "USD" || request.budgetCurrency === "USDC") ? request.budgetMinor : null;

  if (comparableBudget && customerTotalMinor > comparableBudget) {
    const discovery: NonNullable<ManagerAnalysis["discovery"]> = {
      runId,
      status: "OVER_BUDGET",
      observedAt: observedAt.toISOString(),
      catalogServiceCount: services.length,
      eligibleMatchCount,
      missingTaskKeys: [],
      selected: selectedSummary,
      explanation: `Verified supplier coverage exists, but the calculated ${formatMinor(customerTotalMinor, "USDC")} total exceeds the supplied ${formatMinor(comparableBudget, request.budgetCurrency!)} budget ceiling.`,
    };
    await saveDiscoveryOnly(requestId, customerId, analysis, discovery);
    return { kind: "OVER_BUDGET" as const, discovery };
  }

  const quoteVersion = (request.quotes[0]?.version ?? 0) + 1;
  const quoteId = crypto.randomUUID();
  const discovery: NonNullable<ManagerAnalysis["discovery"]> = {
    runId,
    status: "READY_FOR_QUOTE",
    observedAt: observedAt.toISOString(),
    catalogServiceCount: services.length,
    eligibleMatchCount,
    missingTaskKeys: [],
    selected: selectedSummary,
    explanation: "Every planned task has at least one currently available, priced supplier candidate. The quote is based on the selected candidates below.",
    quoteId,
  };
  const updatedAnalysis = toJson({ ...analysis, discovery });
  const expiresAt = new Date(observedAt.getTime() + 24 * 60 * 60 * 1000);

  const saved = await prisma.$transaction(async (tx) => {
    const moved = await tx.serviceRequest.updateMany({ where: { id: requestId, customerId, state: "SCOPED" }, data: { state: "QUOTED", analysisJson: updatedAnalysis, version: { increment: 1 } } });
    if (moved.count !== 1) return false;
    await tx.quote.create({
      data: {
        id: quoteId,
        requestId,
        version: quoteVersion,
        state: "PRESENTED",
        currency: "USDC",
        decimals: 2,
        customerTotalMinor,
        supplierCapMinor: executionCostMinor + reserveMinor,
        executionCostMinor,
        reserveMinor,
        feeMinor,
        estimatedMarginMinor: feeMinor,
        scopeJson: toJson({ title: analysis.plan!.title, objective: analysis.plan!.objective, tasks: analysis.plan!.tasks, selectedSuppliers: selectedSummary }),
        assumptionsJson: toJson([...analysis.plan!.assumptions, "For development budget comparison only, USD and USDC are treated as 1:1. No exchange-rate guarantee is made.", "Supplier prices and availability are observations, not reservations."]),
        exclusionsJson: toJson(["Marketplace hiring before quote acceptance and verified funding", "Unlisted third-party subscriptions, hosting, domains, or paid media", "Work outside the displayed task plan"]),
        termsJson: toJson({ runtimeMode: process.env.AUVRA_RUNTIME_MODE ?? "DEMO_SANDBOX", fundingRequiredBeforeHiring: true, marketplaceWritesEnabled: false, quoteValidityHours: 24 }),
        expiresAt,
        presentedAt: observedAt,
      },
    });
    await tx.auditEvent.create({ data: { actorType: "SYSTEM", eventType: "QUOTE_PRESENTED", requestId, metadataJson: { quoteId, version: quoteVersion, currency: "USDC", customerTotalMinor: customerTotalMinor.toString(), discoveryRunId: runId } } });
    await tx.outboxEvent.create({ data: { aggregateType: "Quote", aggregateId: quoteId, eventType: "quote.presented", idempotencyKey: `quote:${quoteId}:presented`, payloadJson: { quoteId, requestId, version: quoteVersion } } });
    await tx.notification.create({ data: { userId: customerId, type: "QUOTE_READY", title: "Your Auvra quote is ready", body: `Review the ${formatMinor(customerTotalMinor, "USDC")} quote before any funding or supplier hiring.` } });
    return true;
  });

  return saved ? { kind: "QUOTED" as const, quoteId, discovery } : { kind: "IN_PROGRESS" as const };
}

async function saveDiscoveryOnly(requestId: string, customerId: string, analysis: ManagerAnalysis, discovery: NonNullable<ManagerAnalysis["discovery"]>) {
  await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.updateMany({ where: { id: requestId, customerId, state: "SCOPED" }, data: { analysisJson: toJson({ ...analysis, discovery }), version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "SYSTEM", eventType: `SUPPLIER_DISCOVERY_${discovery.status}`, requestId, reason: discovery.explanation, metadataJson: { runId: discovery.runId, catalogServiceCount: discovery.catalogServiceCount, eligibleMatchCount: discovery.eligibleMatchCount, missingTaskKeys: discovery.missingTaskKeys } } });
    await tx.outboxEvent.create({ data: { aggregateType: "ServiceRequest", aggregateId: requestId, eventType: `supplier.discovery_${discovery.status.toLowerCase()}`, idempotencyKey: `request:${requestId}:discovery:${discovery.runId}`, payloadJson: { requestId, runId: discovery.runId, status: discovery.status } } });
  });
}

function deduplicateServices(services: NormalizedService[]) {
  return [...new Map(services.map((service) => [service.externalServiceId, service])).values()];
}

function formatMinor(minor: bigint, currency: string) {
  const value = minor.toString().padStart(3, "0");
  return `${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
