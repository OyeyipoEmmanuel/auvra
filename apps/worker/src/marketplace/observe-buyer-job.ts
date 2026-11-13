import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { parseMarketAssignmentStatus, parseMarketDraftStatus } from "./job-contract.js";
import { mcpBody } from "./live-hire-preflight.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

/** Read-only reconciliation after a human approves the marketplace draft. */
export async function observeBuyerJob(db: PrismaClient, supplierJobId: string) {
  const accountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
  if (process.env.AUVRA_RUNTIME_MODE !== "LIVE_MARKET" || !accountId || !supplierJobId) {
    throw new Error("Live mode, buyer account, and supplier job ID are required.");
  }
  const client = new Client(
    { name: "auvra-job-observation", version: "0.0.0" },
    { capabilities: {} },
  );
  try {
    const job = await db.supplierJob.findUnique({ where: { id: supplierJobId } });
    if (!job || job.provider !== "NEAR_AGENT_MARKET")
      throw new Error("Marketplace supplier job not found.");
    if (!job.externalDraftId && !job.externalJobId)
      throw new Error("No provider draft or job ID to reconcile.");
    const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
    if (provider.accountId !== accountId || !(await provider.tokens()))
      throw new Error("Buyer connection unavailable.");
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
        authProvider: provider,
        requestInit: { signal: AbortSignal.timeout(15_000) },
      }),
    );

    let remoteJobId = job.externalJobId;
    if (!remoteJobId && job.externalDraftId) {
      const draft = parseMarketDraftStatus(
        mcpBody(
          await client.callTool({
            name: "marketplace__get_draft_status",
            arguments: { draft_id: job.externalDraftId },
          }),
        ),
      );
      if (!draft)
        throw new Error("Provider draft status is unrecognized; manual reconciliation required.");
      if (!draft.approved) {
        return { supplierJobId, state: "AWAITING_MARKETPLACE_APPROVAL", charged: false };
      } else {
        remoteJobId = draft.jobId;
        await db.$transaction(async (tx) => {
          const changed = await tx.supplierJob.updateMany({
            where: {
              id: supplierJobId,
              externalDraftId: job.externalDraftId,
              externalJobId: null,
              state: "CREATE_PENDING",
            },
            data: {
              externalJobId: remoteJobId,
              state: "HIRED",
              committedMinor: job.authorizedMinor,
              rawStatus: "approved_unreconciled",
              lastObservedAt: new Date(),
            },
          });
          if (changed.count === 1) {
            const reservation = await tx.spendReservation.updateMany({
              where: {
                idempotencyKey: `auvra:task:${job.taskId}:prepare:v1`,
                projectId: job.projectId,
                taskId: job.taskId,
                serviceId: job.externalServiceId,
                amountMinor: job.authorizedMinor,
                currency: job.currency,
                state: "RESERVED",
              },
              data: { state: "COMMITTED" },
            });
            if (reservation.count !== 1)
              throw new Error("Exact supplier reservation is missing; hire needs reconciliation.");
            await tx.project.updateMany({
              where: { id: job.projectId, state: { in: ["PLANNING", "PROCUREMENT"] } },
              data: { state: "RUNNING", startedAt: new Date() },
            });
            await tx.projectTask.updateMany({
              where: { id: job.taskId, status: "READY" },
              data: { status: "IN_PROGRESS" },
            });
            await tx.auditEvent.create({
              data: {
                actorType: "SYSTEM",
                eventType: "MARKETPLACE_DRAFT_APPROVED",
                projectId: job.projectId,
                supplierJobId,
                metadataJson: {
                  externalJobId: remoteJobId,
                  amountMinor: job.authorizedMinor.toString(),
                  currency: job.currency,
                  settlementVerified: false,
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                aggregateType: "SupplierJob",
                aggregateId: supplierJobId,
                eventType: "supplier.job_hired",
                idempotencyKey: `supplier:${supplierJobId}:hired`,
                payloadJson: { projectId: job.projectId, externalJobId: remoteJobId },
              },
            });
          }
        });
      }
    }
    if (remoteJobId) {
      const status = parseMarketAssignmentStatus(
        mcpBody(
          await client.callTool({
            name: "marketplace__get_job_status",
            arguments: { job_id: remoteJobId },
          }),
        ),
      );
      if (!status)
        throw new Error("Provider assignment status is unrecognized; no state was inferred.");
      if (status.resultAvailable && !status.autoAcceptAt) {
        throw new Error("Delivered result has no review deadline; operator review required.");
      }
      const nextState =
        status.workerState === "submitted" && status.resultAvailable
          ? "SUBMITTED"
          : status.workerState === "in_progress"
            ? "ACTIVE"
            : null;
      await db.$transaction(async (tx) => {
        const current = await tx.supplierJob.findUniqueOrThrow({ where: { id: supplierJobId } });
        const canMove =
          nextState === "SUBMITTED"
            ? ["HIRED", "ACTIVE"].includes(current.state)
            : nextState === "ACTIVE" && current.state === "HIRED";
        const changed = await tx.supplierJob.updateMany({
          where: { id: supplierJobId, state: current.state },
          data: {
            ...(canMove ? { state: nextState! } : {}),
            rawStatus: status.workerState,
            providerStatusJson: {
              workerState: status.workerState,
              resultAvailable: status.resultAvailable,
              expectedBy: status.expectedBy?.toISOString() ?? null,
              autoAcceptAt: status.autoAcceptAt?.toISOString() ?? null,
            },
            autoAcceptAt: status.autoAcceptAt,
            lastObservedAt: new Date(),
          },
        });
        if (changed.count === 1 && canMove && nextState === "SUBMITTED") {
          await tx.outboxEvent.create({
            data: {
              aggregateType: "SupplierJob",
              aggregateId: supplierJobId,
              eventType: "supplier.job_submitted",
              idempotencyKey: `supplier:${supplierJobId}:submitted`,
              payloadJson: {
                projectId: job.projectId,
                autoAcceptAt: status.autoAcceptAt?.toISOString(),
              },
            },
          });
        }
      });
      return {
        supplierJobId,
        externalJobId: remoteJobId,
        workerState: status.workerState,
        resultAvailable: status.resultAvailable,
        autoAcceptAt: status.autoAcceptAt?.toISOString() ?? null,
        automaticAcceptancePerformed: false,
      };
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    console.log(JSON.stringify(await observeBuyerJob(db, process.argv[2]!)));
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.includes("observe-buyer-job")) await main();
