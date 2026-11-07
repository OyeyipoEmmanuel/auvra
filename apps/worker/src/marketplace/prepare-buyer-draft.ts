import { createHash, randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { claimExternalAction, prepareExternalAction } from "../orchestration/external-actions.js";
import { reserveSupplierSpend } from "../policy/reserve-spend.js";
import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { parsePreparedMarketDraft } from "./job-contract.js";
import { mcpBody, parseLiveAgentProfile } from "./live-hire-preflight.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
const databaseUrl = process.env.DATABASE_URL;
const accountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
const [projectId, taskKey, approvalId, consent] = process.argv.slice(2);

if (
  process.env.AUVRA_RUNTIME_MODE !== "LIVE_MARKET" ||
  process.env.MARKETPLACE_WRITES_ENABLED !== "true" ||
  process.env.AUVRA_M8_PREPARE_ENABLED !== "true" ||
  consent !== "--consent-to-share" ||
  !databaseUrl ||
  !accountId ||
  !projectId ||
  !taskKey ||
  !approvalId
) {
  throw new Error(
    "Live mode, marketplace writes, explicit draft flag, project/task/approval, and sharing consent are required.",
  );
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const client = new Client({ name: "auvra-buyer-draft", version: "0.0.0" }, { capabilities: {} });
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
  if (project.state !== "PLANNING" && project.state !== "PROCUREMENT")
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
  const supplierJob = await db.supplierJob.findFirst({
    where: { taskId: task.id, provider: "NEAR_AGENT_MARKET", state: "PROPOSED" },
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
    new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
      authProvider: provider,
      requestInit: { signal: AbortSignal.timeout(15_000) },
    }),
  );
  const rawProfile = mcpBody(
    await client.callTool({ name: "marketplace__get_agent", arguments: { agent_id: agentId } }),
  );
  const live = parseLiveAgentProfile(rawProfile, agentId);
  if (!live || !live.acceptingWork || live.currency !== "USD" || live.requiredRoles.length > 0) {
    throw new Error("Agent is unavailable, incompatible, or requires connected tools review.");
  }
  if (live.priceMinor > task.budgetMinor)
    throw new Error("Fresh agent price exceeds the task cap.");
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
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (
    approval?.supplierJobId !== supplierJob.id ||
    approval.amountMinor !== live.priceMinor ||
    approval.currency !== "USD"
  ) {
    throw new Error("The operator approval must name this exact proposed job and price.");
  }

  const description = [
    `Auvra task: ${task.title}`,
    `Objective: ${task.objective}`,
    `Customer brief: ${project.request.rawBrief}`,
    "Do not access private attachments. Ask for clarification through the job thread if needed.",
  ].join("\n\n");
  if (description.length > 10_000) throw new Error("Job brief exceeds marketplace limit.");
  const idempotencyKey = `auvra:task:${task.id}:prepare:v1`;
  const payload = {
    worker_agent_id: agentId,
    title: task.title.slice(0, 200),
    description,
    client_request_id: idempotencyKey,
    token: "USD",
    acceptance_window_days: 7,
  };
  const requestHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  if (supplierJob.requestHash && supplierJob.requestHash !== requestHash) {
    throw new Error("The previously prepared brief differs; manual review is required.");
  }
  const reservation = await reserveSupplierSpend(db, {
    projectId,
    taskId: task.id,
    supplierJobId: supplierJob.id,
    serviceId: observation.externalServiceId,
    amountMinor: live.priceMinor,
    currency: "USD",
    approvalId,
    idempotencyKey,
  });
  if (reservation.kind !== "RESERVED")
    throw new Error(`Spend gate denied draft preparation: ${reservation.kind}`);
  const action = await prepareExternalAction(db, {
    idempotencyKey,
    provider: "NEAR_AGENT_MARKET",
    actionType: "PREPARE_JOB_DRAFT",
    requestHash,
  });
  if (action.kind !== "PREPARED")
    throw new Error("Existing preparation requires reconciliation; no repeat call made.");
  await db.supplierJob.update({ where: { id: supplierJob.id }, data: { requestHash } });
  if ((await claimExternalAction(db, idempotencyKey, randomUUID())) !== "CLAIMED") {
    throw new Error("Draft action was not claimable; manual review required.");
  }
  try {
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
    console.log(
      JSON.stringify({
        supplierJobId: supplierJob.id,
        draftId: draft.draftId,
        approvalUrl: draft.approvalUrl,
        charged: false,
      }),
    );
  } catch {
    await db.externalAction.updateMany({
      where: { idempotencyKey, state: "IN_FLIGHT" },
      data: { state: "UNKNOWN", leaseOwner: null, leaseExpiresAt: null },
    });
    throw new Error("Draft outcome is ambiguous. Reconcile the provider draft before any retry.");
  }
} finally {
  await client.close().catch(() => undefined);
  await db.$disconnect();
}
