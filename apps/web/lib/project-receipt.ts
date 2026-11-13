import "server-only";

import { prisma } from "@/lib/prisma";
import { noChargeProjectProof } from "../../../src/receipts/no-charge-project";

export async function getNoChargeProjectReceipt(projectId: string, customerId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, customerId },
    include: {
      request: { select: { rawBrief: true } },
      payments: {
        where: { provider: "DEMO_SANDBOX" },
        take: 1,
        include: { quote: true },
      },
      receipts: {
        where: { kind: "PROJECT", network: "testnet" },
        take: 1,
      },
    },
  });
  if (!project || project.payments.length === 0) return null;
  return {
    project,
    payment: project.payments[0],
    anchor: project.receipts[0] ?? null,
  };
}

export function noChargeReceiptDocument(
  receipt: NonNullable<Awaited<ReturnType<typeof getNoChargeProjectReceipt>>>,
) {
  const { project, payment, anchor } = receipt;
  const proof = localNoChargeProof(receipt);
  const verified =
    anchor?.state === "CONFIRMED" &&
    Boolean(anchor.contractAccount) &&
    proof?.canonicalRecordHash === anchor.canonicalRecordHash;
  return {
    receiptType: "PROJECT_RECORD",
    projectId: project.id,
    issuedAt: payment.createdAt.toISOString(),
    brief: project.request.rawBrief,
    quote: {
      version: payment.quote.version,
      currency: payment.quote.currency,
      quotedAmountMinor: payment.quote.customerTotalMinor.toString(),
    },
    chargedAmountMinor: "0",
    chargedCurrency: payment.quote.currency,
    onchain: {
      network: "testnet",
      status: verified ? "VERIFIED" : "PENDING",
      referenceHash: anchor?.referenceHash ?? proof?.referenceHash ?? null,
      recordHash: anchor?.canonicalRecordHash ?? proof?.canonicalRecordHash ?? null,
      quoteHash: proof?.quoteHash ?? null,
      canonicalRecord: proof
        ? {
            kind: "PROJECT",
            schemaVersion: 1,
            projectReference: project.id,
            quoteVersion: payment.quote.version,
            quoteHash: proof.quoteHash,
            fundingMode: "NO_CHARGE",
          }
        : null,
      contractAccount: verified ? anchor?.contractAccount : null,
      transactionHash: verified ? anchor?.transactionHash : null,
      verifiedAt: verified ? anchor?.confirmedAt?.toISOString() : null,
    },
  };
}

export function localNoChargeProof(
  receipt: NonNullable<Awaited<ReturnType<typeof getNoChargeProjectReceipt>>>,
) {
  const { project, payment } = receipt;
  return payment.quote.acceptedAt
    ? noChargeProjectProof(project.id, {
        ...payment.quote,
        acceptedAt: payment.quote.acceptedAt,
      })
    : null;
}
