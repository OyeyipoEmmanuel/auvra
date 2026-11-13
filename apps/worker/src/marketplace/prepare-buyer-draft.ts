import { createHash, randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import {
  claimExternalAction,
  claimPaidHireReplay,
  prepareExternalAction,
} from "../orchestration/external-actions.js";
import { reserveSupplierSpend } from "../policy/reserve-spend.js";
import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { parseCreatedMarketJob, parsePreparedMarketDraft } from "./job-contract.js";
import { mcpBody, parseLiveAgentProfile } from "./live-hire-preflight.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";
import { recordPaidHire } from "./record-paid-hire.js";

type BuyerAction = "draft" | "hire";

export class BuyerActionBlockedError extends Error {
  constructor(readonly reasons: string[]) {
    super(`Buyer action blocked: ${reasons.join(", ")}`);
  }
}

/** Shared exact-approval gate for either a no-charge draft or a paid hire. */
async function runApprovedBuyerAction(
  db: PrismaClient,
  projectId: string,
  taskKey: string,
  approvalId: string | undefined,
  consentToShare: boolean,
  action: BuyerAction,
) {
  const accountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
  if (
    process.env.AUVRA_RUNTIME_MODE !== "LIVE_MARKET" ||
    process.env.MARKETPLACE_WRITES_ENABLED !== "true" ||
    (process.env.AUVRA_M8_PREPARE_ENABLED === "true" &&
      process.env.AUVRA_M8_DIRECT_HIRE_ENABLED === "true") ||
    (action === "draft"
      ? process.env.AUVRA_M8_PREPARE_ENABLED !== "true"
      : process.env.AUVRA_M8_DIRECT_HIRE_ENABLED !== "true") ||
    !consentToShare ||
    !accountId ||
    !projectId ||
    !taskKey ||
    (action === "draft" && !approvalId)
  ) {
    throw new Error(
      "Live buyer action, buyer account, exact approval, and sharing consent are required.",
    );
  }
  const client = new Client({ name: "auvra-buyer-worker", version: "0.0.0" }, { capabilities: {} });
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
        payments: true,
      },
    });
    const task = project?.tasks[0];
    const quote = project?.request.quotes[0];
    const match = project?.request.supplierMatches[0];
    const observation = match?.serviceObservation;
    const agentId = observation?.externalAgentId;
    if (!project || !task || !quote || !observation || !agentId)
      throw new Error("Project, accepted quote, task, or selected agent is missing.");
    if (!["PLANNING", "PROCUREMENT", "RUNNING"].includes(project.state))
      throw new Error("Project is not ready for procurement.");
    if (task.status !== "READY") throw new Error("Task is not dependency-ready.");
    if (!observation.expiresAt || observation.expiresAt <= new Date())
      throw new Error("Selected marketplace observation expired; re-quote first.");
    if (quote.currency !== "USD" || task.budgetCurrency !== "USD")
      throw new Error("Only exact USD matching is enabled.");
    const customerPayment = project.payments.find(
      (payment) =>
        payment.provider === "BACHS" &&
        payment.quoteId === quote.id &&
        payment.currency === quote.currency &&
        payment.amountMinor === quote.customerTotalMinor &&
        payment.verifiedAt &&
        ["VERIFIED", "ALLOCATED", "RECONCILED"].includes(payment.state),
    );
    if (!customerPayment) throw new Error("Verified live customer payment is missing.");
    const customerConsent = await db.auditEvent.findFirst({
      where: { requestId: project.requestId, eventType: "REQUEST_SUBMITTED" },
      orderBy: { occurredAt: "desc" },
    });
    const consentEvidence = customerConsent?.metadataJson;
    if (
      !consentEvidence ||
      typeof consentEvidence !== "object" ||
      Array.isArray(consentEvidence) ||
      consentEvidence.externalAgentConsent !== true
    ) {
      throw new Error("Audited customer consent to supplier sharing is missing.");
    }
    const supplierJob = await db.supplierJob.findFirst({
      where: {
        taskId: task.id,
        provider: "NEAR_AGENT_MARKET",
        state: { in: ["PROPOSED", "CREATE_PENDING"] },
      },
    });
    if (
      !supplierJob ||
      supplierJob.externalAgentId !== agentId ||
      supplierJob.externalServiceId !== observation.externalServiceId
    ) {
      throw new Error("Create and review one exact supplier proposal before preparing a draft.");
    }

    const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
    if (provider.accountId !== accountId || !(await provider.tokens()))
      throw new Error("Buyer connection is missing or bound to another account.");
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(
          action === "hire" ? "https://market.near.ai/mcp/pro" : "https://market.near.ai/mcp",
        ),
        {
          authProvider: provider,
          requestInit: { signal: AbortSignal.timeout(15_000) },
        },
      ),
    );
    if (action === "hire") {
      const { tools } = await client.listTools();
      if (!tools.some((tool) => tool.name === "marketplace__create_job")) {
        throw new Error("Paid marketplace hire tool is unavailable for this buyer connection.");
      }
    }
    const rawProfile = mcpBody(
      await client.callTool({ name: "marketplace__get_agent", arguments: { agent_id: agentId } }),
    );
    const live = parseLiveAgentProfile(rawProfile, agentId);
    if (!live || !live.acceptingWork || live.currency !== "USD" || live.requiredRoles.length > 0) {
      throw new Error("Agent is unavailable, incompatible, or requires connected tools review.");
    }
    if (live.priceMinor > task.budgetMinor)
      throw new Error("Fresh agent price exceeds the task cap.");
    const hardCap = process.env.MARKETPLACE_MAX_SPEND_MINOR;
    if (!hardCap || !/^[1-9]\d*$/.test(hardCap) || live.priceMinor > BigInt(hardCap)) {
      throw new Error("The worker's hard per-job spend cap is missing or too low.");
    }
    const snapshot = supplierJob.listingSnapshotJson;
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot) ||
      snapshot.priceMinor !== live.priceMinor.toString() ||
      snapshot.currency !== live.currency ||
      snapshot.agentId !== agentId ||
      supplierJob.authorizedMinor !== live.priceMinor
    ) {
      throw new Error("Approved proposal no longer matches the fresh marketplace listing.");
    }
    if (approvalId) {
      const approval = await db.approval.findUnique({ where: { id: approvalId } });
      if (
        approval?.supplierJobId !== supplierJob.id ||
        approval.amountMinor !== live.priceMinor ||
        approval.currency !== "USD"
      ) {
        throw new Error("The operator approval must name this exact proposed job and price.");
      }
      const operatorConsent = await db.auditEvent.findFirst({
        where: { supplierJobId: supplierJob.id, eventType: "SUPPLIER_JOB_APPROVED" },
        orderBy: { occurredAt: "desc" },
      });
      const operatorEvidence = operatorConsent?.metadataJson;
      if (
        !operatorEvidence ||
        typeof operatorEvidence !== "object" ||
        Array.isArray(operatorEvidence) ||
        operatorEvidence.approvalId !== approvalId ||
        operatorEvidence.consentToShare !== true
      ) {
        throw new Error("Audited operator approval for sharing this brief is missing.");
      }
    }
    if (
      supplierJob.state === "CREATE_PENDING" &&
      supplierJob.externalDraftId &&
      supplierJob.approvalUrl
    ) {
      return {
        supplierJobId: supplierJob.id,
        draftId: supplierJob.externalDraftId,
        approvalUrl: supplierJob.approvalUrl,
        charged: false,
      };
    }
    if (supplierJob.state !== "PROPOSED") {
      throw new Error("Supplier draft is in an unreconciled state.");
    }

    const description = [
      `Auvra task: ${task.title}`,
      `Objective: ${task.objective}`,
      `Customer brief: ${project.request.rawBrief}`,
      "Do not access private attachments. Ask for clarification through the job thread if needed.",
    ].join("\n\n");
    if (description.length > 10_000) throw new Error("Job brief exceeds marketplace limit.");
    const idempotencyKey =
      action === "hire" ? `auvra:hire:${supplierJob.id}` : `auvra:task:${task.id}:prepare:v1`;
    const payload = {
      worker_agent_id: agentId,
      title: task.title.slice(0, 200),
      description,
      client_request_id: action === "hire" ? supplierJob.id : idempotencyKey,
      token: "USD",
      acceptance_window_days: 7,
    };
    const requestHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    if (supplierJob.requestHash && supplierJob.requestHash !== requestHash) {
      throw new Error("The previously prepared brief differs; manual review is required.");
    }
    const priorAction = await db.externalAction.findUnique({ where: { idempotencyKey } });
    const replayingPaidHire = action === "hire" && priorAction?.state === "UNKNOWN";
    const reservation = replayingPaidHire
      ? { kind: "ALREADY_RESERVED" as const }
      : await reserveSupplierSpend(db, {
          projectId,
          taskId: task.id,
          supplierJobId: supplierJob.id,
          serviceId: observation.externalServiceId,
          amountMinor: live.priceMinor,
          currency: "USD",
          ...(approvalId ? { approvalId } : {}),
          idempotencyKey,
        });
    if (reservation.kind === "ALREADY_RESERVED") {
      const prior = await db.spendReservation.findUnique({ where: { idempotencyKey } });
      if (
        !prior ||
        prior.state !== "RESERVED" ||
        prior.projectId !== projectId ||
        prior.taskId !== task.id ||
        prior.serviceId !== observation.externalServiceId ||
        prior.approvalId !== (approvalId ?? null) ||
        prior.amountMinor !== live.priceMinor ||
        prior.currency !== "USD"
      )
        throw new Error("Existing spend reservation does not match this exact job.");
    } else if (reservation.kind === "DENIED") {
      throw new BuyerActionBlockedError(reservation.reasons);
    } else if (reservation.kind !== "RESERVED") {
      throw new BuyerActionBlockedError([reservation.kind]);
    }
    const actionRecord = await prepareExternalAction(db, {
      idempotencyKey,
      provider: "NEAR_AGENT_MARKET",
      actionType: action === "hire" ? "CREATE_PAID_JOB" : "PREPARE_JOB_DRAFT",
      requestHash,
    });
    if (
      actionRecord.kind === "EXISTING" &&
      !(actionRecord.action.state === "UNKNOWN" && action === "hire") &&
      !(actionRecord.action.state === "PREPARED" && actionRecord.action.attemptCount === 0)
    ) {
      throw new Error("Existing buyer action requires reconciliation; no repeat call made.");
    }
    const lockedJob = await db.supplierJob.updateMany({
      where: {
        id: supplierJob.id,
        state: "PROPOSED",
        OR: [{ requestHash: null }, { requestHash }],
      },
      data: { requestHash },
    });
    if (lockedJob.count !== 1) {
      throw new Error("Supplier proposal changed before the marketplace call.");
    }
    const claimed =
      actionRecord.kind === "EXISTING" && actionRecord.action.state === "UNKNOWN"
        ? await claimPaidHireReplay(db, idempotencyKey, randomUUID())
        : await claimExternalAction(db, idempotencyKey, randomUUID());
    if (claimed !== "CLAIMED") {
      throw new Error("Buyer action was not claimable; manual review required.");
    }
    try {
      if (action === "hire") {
        const created = parseCreatedMarketJob(
          mcpBody(
            await client.callTool(
              { name: "marketplace__create_job", arguments: payload },
              { timeout: 25_000 },
            ),
          ),
          "USD",
        );
        if (!created || created.chargedMinor !== live.priceMinor) {
          throw new Error("Paid hire response does not prove the exact approved price.");
        }
        await recordPaidHire(
          db,
          {
            id: supplierJob.id,
            projectId,
            taskId: task.id,
            externalServiceId: observation.externalServiceId,
            authorizedMinor: live.priceMinor,
            currency: "USD",
            requestHash,
            idempotencyKey,
          },
          created,
        );
        return { supplierJobId: supplierJob.id, externalJobId: created.jobId, charged: true };
      }
      const draft = parsePreparedMarketDraft(
        mcpBody(
          await client.callTool(
            { name: "marketplace__prepare_job", arguments: payload },
            { timeout: 15_000 },
          ),
        ),
        "USD",
      );
      if (!draft || draft.quotedPriceMinor !== live.priceMinor) {
        throw new Error("Marketplace draft response or price does not match the approved listing.");
      }
      await db.$transaction(async (tx) => {
        await tx.supplierJob.update({
          where: { id: supplierJob.id },
          data: {
            state: "CREATE_PENDING",
            externalDraftId: draft.draftId,
            approvalUrl: draft.approvalUrl,
            lastObservedAt: new Date(),
          },
        });
        await tx.project.updateMany({
          where: { id: projectId, state: "PLANNING" },
          data: { state: "PROCUREMENT" },
        });
        await tx.externalAction.update({
          where: { idempotencyKey },
          data: {
            state: "CONFIRMED",
            externalId: draft.draftId,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorType: "SYSTEM",
            eventType: "SUPPLIER_DRAFT_PREPARED",
            projectId,
            supplierJobId: supplierJob.id,
            inputHash: requestHash,
            metadataJson: {
              draftId: draft.draftId,
              amountMinor: live.priceMinor.toString(),
              currency: "USD",
            },
          },
        });
      });
      return {
        supplierJobId: supplierJob.id,
        draftId: draft.draftId,
        approvalUrl: draft.approvalUrl,
        charged: false,
      };
    } catch {
      await db.externalAction.updateMany({
        where: { idempotencyKey, state: "IN_FLIGHT" },
        data: { state: "UNKNOWN", leaseOwner: null, leaseExpiresAt: null },
      });
      throw new Error(
        action === "hire"
          ? "Paid hire outcome is uncertain. Retry only with the recorded marketplace request ID."
          : "Draft outcome is ambiguous. Reconcile the provider draft before any retry.",
      );
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** Legacy no-charge marketplace path, retained for deployments without delegated hiring. */
export function prepareBuyerDraft(
  db: PrismaClient,
  projectId: string,
  taskKey: string,
  approvalId: string,
  consentToShare: boolean,
) {
  return runApprovedBuyerAction(db, projectId, taskKey, approvalId, consentToShare, "draft");
}

/** Paid hire, guarded by the live mode, exact approval, policy, and wallet balance. */
export function hireBuyerJob(
  db: PrismaClient,
  projectId: string,
  taskKey: string,
  approvalId: string | undefined,
  consentToShare: boolean,
) {
  return runApprovedBuyerAction(db, projectId, taskKey, approvalId, consentToShare, "hire");
}

async function main() {
  if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const [projectId, taskKey, approvalId] = process.argv
      .slice(2)
      .filter((argument) => !argument.startsWith("--"));
    console.log(
      JSON.stringify(
        await (process.argv.includes("--hire") ? hireBuyerJob : prepareBuyerDraft)(
          db,
          projectId!,
          taskKey!,
          approvalId!,
          process.argv.includes("--consent-to-share"),
        ),
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.includes("prepare-buyer-draft")) await main();
