import { type PrismaClient } from "@prisma/client";

import { sha256Canonical, sha256Text, type CanonicalValue } from "./canonical.js";

type ChainReceipt = { reference_hash: string; canonical_record_hash: string };
type ChainSubmission = { transactionHash: string; blockReference?: string };

export interface ReceiptAnchorAdapter {
  network: "testnet" | "mainnet";
  contractAccount: string;
  signerAccount: string;
  getProjectReceipt(referenceHash: string): Promise<ChainReceipt | null>;
  getSettlementReceipt(referenceHash: string): Promise<ChainReceipt | null>;
  getTransactionStatus(
    transactionHash: string,
  ): Promise<"SUCCESS" | "FAILURE" | "PENDING" | "UNKNOWN">;
  recordProjectReceipt(
    referenceHash: string,
    canonicalRecordHash: string,
  ): Promise<ChainSubmission>;
  recordSettlementReceipt(
    referenceHash: string,
    canonicalRecordHash: string,
    providerReceiptHash: string,
  ): Promise<ChainSubmission>;
}

/** Prepares a hash-only project proof after a real payment and immutable accepted scope. */
export async function prepareProjectAnchor(
  db: PrismaClient,
  projectId: string,
  network: "testnet" | "mainnet",
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      request: { include: { quotes: { where: { state: "ACCEPTED" }, take: 1 } } },
      payments: {
        where: { state: { in: ["ALLOCATED", "RECONCILED"] }, provider: "BACHS" },
      },
    },
  });
  const quote = project?.request.quotes[0];
  const payment = project?.payments.find(
    (entry) => entry.quoteId === quote?.id && entry.verifiedAt,
  );
  if (!project || !quote || !quote.acceptedAt || !payment) return { kind: "NOT_READY" as const };
  const referenceHash = sha256Text(projectId);
  const quoteHash = sha256Canonical({
    quoteId: quote.id,
    quoteVersion: quote.version,
    currency: quote.currency,
    customerTotalMinor: quote.customerTotalMinor.toString(),
    supplierCapMinor: quote.supplierCapMinor.toString(),
    scope: quote.scopeJson as CanonicalValue,
    assumptions: quote.assumptionsJson as CanonicalValue,
    exclusions: quote.exclusionsJson as CanonicalValue,
    terms: quote.termsJson as CanonicalValue,
    acceptedAt: quote.acceptedAt.toISOString(),
  });
  const canonicalRecordHash = sha256Canonical({
    kind: "PROJECT",
    schemaVersion: 1,
    projectReference: projectId,
    quoteVersion: quote.version,
    quoteHash,
  });
  const anchor = await db.receiptAnchor.upsert({
    where: { network_kind_referenceHash: { network, kind: "PROJECT", referenceHash } },
    create: {
      projectId,
      kind: "PROJECT",
      schemaVersion: 1,
      referenceHash,
      canonicalRecordHash,
      network,
    },
    update: {},
  });
  if (
    anchor.projectId !== projectId ||
    anchor.canonicalRecordHash !== canonicalRecordHash ||
    anchor.network !== network
  )
    return { kind: "CONFLICT" as const };
  return { kind: "READY" as const, anchorId: anchor.id };
}

/** Settlement proof is delayed until provider and ledger references are reconciled. */
export async function prepareSettlementAnchor(
  db: PrismaClient,
  projectId: string,
  network: "testnet" | "mainnet",
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      payments: { where: { state: "RECONCILED", provider: "BACHS" } },
      supplierJobs: true,
    },
  });
  if (
    !project ||
    project.supplierJobs.length === 0 ||
    project.supplierJobs.some(
      (job) =>
        !job.externalJobId || job.settledMinor !== job.committedMinor || job.state !== "ACCEPTED",
    )
  )
    return { kind: "NOT_READY" as const };
  const payment = project.payments.find((entry) => entry.reconciledAt && entry.providerReference);
  if (!payment) return { kind: "NOT_READY" as const };
  const reconciliation = await db.auditEvent.findFirst({
    where: { projectId, eventType: "SETTLEMENT_RECONCILED" },
  });
  if (!reconciliation) return { kind: "NOT_READY" as const };
  const journals = await db.ledgerTransaction.findMany({
    where: { projectId },
    include: { entries: { include: { account: true } } },
    orderBy: { id: "asc" },
  });
  if (journals.length === 0 || journals.some((journal) => journal.entries.length < 2))
    return { kind: "NOT_READY" as const };
  const ledgerHash = sha256Canonical(
    journals.map((journal) => ({
      transactionId: journal.id,
      transactionType: journal.transactionType,
      asset: journal.asset,
      entries: journal.entries
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((entry) => ({
          accountCode: entry.account.code,
          accountAsset: entry.account.asset,
          side: entry.side,
          amountMinor: entry.amountMinor.toString(),
        })),
    })),
  );
  const referenceHash = sha256Text(`settlement:${projectId}`);
  const providerReceiptHash = sha256Text(
    project.supplierJobs
      .map((job) => `${job.provider}:${job.externalJobId}`)
      .sort()
      .join("|"),
  );
  const canonicalRecordHash = sha256Canonical({
    kind: "SETTLEMENT",
    schemaVersion: 1,
    projectReference: projectId,
    paymentReferenceHash: sha256Text(`${payment.provider}:${payment.providerReference}`),
    providerReceiptHash,
    ledgerHash,
  });
  const anchor = await db.receiptAnchor.upsert({
    where: { network_kind_referenceHash: { network, kind: "SETTLEMENT", referenceHash } },
    create: {
      projectId,
      kind: "SETTLEMENT",
      schemaVersion: 1,
      referenceHash,
      canonicalRecordHash,
      providerReceiptHash,
      network,
    },
    update: {},
  });
  if (
    anchor.projectId !== projectId ||
    anchor.canonicalRecordHash !== canonicalRecordHash ||
    anchor.network !== network
  )
    return { kind: "CONFLICT" as const };
  return { kind: "READY" as const, anchorId: anchor.id };
}

/** Query the chain first after any restart or ambiguous submission. Never blindly send twice. */
export async function reconcileAndSubmitAnchor(
  db: PrismaClient,
  adapter: ReceiptAnchorAdapter,
  anchorId: string,
) {
  const anchor = await db.receiptAnchor.findUnique({ where: { id: anchorId } });
  if (
    !anchor ||
    anchor.network !== adapter.network ||
    (anchor.contractAccount && anchor.contractAccount !== adapter.contractAccount)
  )
    return { kind: "NOT_READY" as const };
  const remote =
    anchor.kind === "PROJECT"
      ? await adapter.getProjectReceipt(anchor.referenceHash)
      : await adapter.getSettlementReceipt(anchor.referenceHash);
  if (remote) {
    if (
      remote.canonical_record_hash !== anchor.canonicalRecordHash ||
      remote.reference_hash !== anchor.referenceHash
    )
      return { kind: "CONFLICT" as const };
    await db.receiptAnchor.update({
      where: { id: anchorId },
      data: {
        state: "CONFIRMED",
        contractAccount: adapter.contractAccount,
        signerAccount: adapter.signerAccount,
        confirmedAt: new Date(),
        lastReconciledAt: new Date(),
      },
    });
    return { kind: "CONFIRMED" as const };
  }
  if (
    anchor.transactionHash ||
    anchor.state === "SUBMITTED" ||
    anchor.state === "RECONCILIATION_REQUIRED"
  ) {
    if (anchor.transactionHash) {
      const status = await adapter.getTransactionStatus(anchor.transactionHash);
      if (status === "FAILURE") {
        await db.receiptAnchor.update({
          where: { id: anchorId },
          data: { state: "FAILED", lastReconciledAt: new Date() },
        });
        return { kind: "FAILED_ON_CHAIN" as const };
      }
    }
    await db.receiptAnchor.update({
      where: { id: anchorId },
      data: { state: "RECONCILIATION_REQUIRED", lastReconciledAt: new Date() },
    });
    return { kind: "AWAITING_CHAIN_RECONCILIATION" as const };
  }
  try {
    const submission =
      anchor.kind === "PROJECT"
        ? await adapter.recordProjectReceipt(anchor.referenceHash, anchor.canonicalRecordHash)
        : await adapter.recordSettlementReceipt(
            anchor.referenceHash,
            anchor.canonicalRecordHash,
            anchor.providerReceiptHash!,
          );
    await db.receiptAnchor.update({
      where: { id: anchorId },
      data: {
        state: "SUBMITTED",
        contractAccount: adapter.contractAccount,
        signerAccount: adapter.signerAccount,
        transactionHash: submission.transactionHash,
        blockReference: submission.blockReference ?? null,
        submittedAt: new Date(),
        lastReconciledAt: new Date(),
      },
    });
    return { kind: "SUBMITTED" as const, transactionHash: submission.transactionHash };
  } catch {
    await db.receiptAnchor.update({
      where: { id: anchorId },
      data: { state: "RECONCILIATION_REQUIRED", lastReconciledAt: new Date() },
    });
    return { kind: "AMBIGUOUS_SUBMISSION" as const };
  }
}
