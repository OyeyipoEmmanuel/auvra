import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { parseMarketAssignmentStatus, parseMarketDraftStatus } from "./job-contract.js";
import { mcpBody } from "./live-hire-preflight.js";
import { PersistentBuyerOAuthProvider } from "./persistent-oauth-provider.js";

if (!process.env.DATABASE_URL) config({ path: "../../.env.local", quiet: true });
const databaseUrl = process.env.DATABASE_URL;
const accountId = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
const supplierJobId = process.argv[2];
if (!databaseUrl || !accountId || !supplierJobId) {
  throw new Error("DATABASE_URL, buyer account/key, and supplier job ID are required.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
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
      console.log(
        JSON.stringify({ supplierJobId, state: "AWAITING_MARKETPLACE_APPROVAL", charged: false }),
      );
      process.exitCode = 0;
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
    const current = await db.supplierJob.findUniqueOrThrow({ where: { id: supplierJobId } });
    const canMove =
      nextState === "SUBMITTED"
        ? ["HIRED", "ACTIVE"].includes(current.state)
        : nextState === "ACTIVE" && current.state === "HIRED";
    await db.$transaction(async (tx) => {
      await tx.supplierJob.update({
        where: { id: supplierJobId },
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
      if (canMove && nextState === "SUBMITTED") {
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
    console.log(
      JSON.stringify({
        supplierJobId,
        externalJobId: remoteJobId,
        workerState: status.workerState,
        resultAvailable: status.resultAvailable,
        autoAcceptAt: status.autoAcceptAt?.toISOString() ?? null,
        automaticAcceptancePerformed: false,
      }),
    );
  }
} finally {
  await client.close().catch(() => undefined);
  await db.$disconnect();
}
