import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config } from "dotenv";

import { validateArtifact } from "../qa/validate-artifact.js";
import { buyerCredentialKey } from "./buyer-oauth-store.js";
import { parseMarketResultPage } from "./job-contract.js";
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
const client = new Client({ name: "auvra-result-intake", version: "0.0.0" }, { capabilities: {} });
try {
  const job = await db.supplierJob.findUnique({
    where: { id: supplierJobId },
    include: { task: true },
  });
  if (
    !job ||
    job.provider !== "NEAR_AGENT_MARKET" ||
    !job.externalJobId ||
    job.state !== "SUBMITTED"
  ) {
    throw new Error("A submitted, authenticated marketplace job is required.");
  }
  const provider = await PersistentBuyerOAuthProvider.load(db, buyerCredentialKey());
  if (provider.accountId !== accountId || !(await provider.tokens()))
    throw new Error("Buyer connection unavailable.");
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://market.near.ai/mcp"), {
      authProvider: provider,
      requestInit: { signal: AbortSignal.timeout(15_000) },
    }),
  );
  let offset = 0;
  let text = "";
  let externalUrl: string | null = null;
  let complete = false;
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = parseMarketResultPage(
      mcpBody(
        await client.callTool({
          name: "marketplace__get_job_result",
          arguments: { job_id: job.externalJobId, offset },
        }),
      ),
    );
    if (!page) throw new Error("Provider result format is unrecognized; manual review required.");
    if (page.status === "external") {
      if (pageNumber > 0) throw new Error("Mixed result types require manual review.");
      externalUrl = page.deliverableUrl;
      complete = true;
      break;
    }
    if (page.fileCount > 0)
      throw new Error("Marketplace files require private file intake before customer delivery.");
    text += page.contentChunk;
    if (text.length > 1_000_000) throw new Error("Result exceeds the text intake limit.");
    if (page.nextOffset === null) {
      complete = true;
      break;
    }
    if (page.nextOffset <= offset) throw new Error("Provider result paging did not advance.");
    offset = page.nextOffset;
  }
  if (!complete) throw new Error("Provider result has too many pages; manual review required.");
  const bytes = externalUrl ? null : new TextEncoder().encode(text);
  const contentHash = createHash("sha256")
    .update(externalUrl ?? text)
    .digest("hex");
  const validation = validateArtifact(
    {
      text: externalUrl ? null : text,
      externalUrl,
      bytes,
      expectedSha256: bytes ? contentHash : null,
      mimeType: externalUrl ? null : "text/plain",
    },
    job.task.validationRulesJson,
  );
  const idempotencyKey = `${supplierJobId}:${contentHash}`;
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${job.projectId}::uuid FOR UPDATE`;
    const previous = await tx.idempotencyRecord.findUnique({
      where: { scope_idempotencyKey: { scope: "MARKET_RESULT_INGEST", idempotencyKey } },
    });
    if (previous) return { kind: "ALREADY_INGESTED" as const };
    const artifact = await tx.artifact.create({
      data: {
        projectId: job.projectId,
        supplierJobId,
        kind: externalUrl ? "MARKETPLACE_EXTERNAL" : "MARKETPLACE_TEXT",
        externalUrl,
        sha256: bytes ? contentHash : null,
        metadataJson: externalUrl
          ? { source: "NEAR_AGENT_MARKET", referenceHash: contentHash }
          : { source: "NEAR_AGENT_MARKET", text },
      },
    });
    await tx.qaReview.create({
      data: {
        projectId: job.projectId,
        artifactId: artifact.id,
        policyVersion: "M9_DETERMINISTIC_V1",
        result: validation.result,
        evidenceJson: validation.evidence,
        violationsJson: validation.violations,
      },
    });
    await tx.idempotencyRecord.create({
      data: {
        scope: "MARKET_RESULT_INGEST",
        idempotencyKey,
        requestHash: contentHash,
        completedAt: new Date(),
        responseJson: { artifactId: artifact.id },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        eventType: "MARKETPLACE_RESULT_INGESTED",
        projectId: job.projectId,
        supplierJobId,
        inputHash: contentHash,
        metadataJson: { artifactId: artifact.id, validationResult: validation.result },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Artifact",
        aggregateId: artifact.id,
        eventType: "qa.deterministic_completed",
        idempotencyKey: `artifact:${artifact.id}:deterministic`,
        payloadJson: { projectId: job.projectId, result: validation.result },
      },
    });
    return { kind: "INGESTED" as const, artifactId: artifact.id };
  });
  console.log(
    JSON.stringify({
      supplierJobId,
      outcome,
      validationResult: validation.result,
      customerVisible: false,
    }),
  );
} finally {
  await client.close().catch(() => undefined);
  await db.$disconnect();
}
