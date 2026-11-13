import type { PrismaClient } from "@prisma/client";

import { reconcileAndSubmitAnchor } from "./anchor.js";
import { createNearReceiptAdapter } from "./near-adapter.js";
import { noChargeProjectProof } from "../../../../src/receipts/no-charge-project.js";

/** Only approved no-charge project records are eligible for this testnet process. */
export async function processTestnetProjectReceipts(db: PrismaClient) {
  if (process.env.AUVRA_TESTNET_RECEIPTS_ENABLED !== "true") return 0;
  if (process.env.NEAR_RECEIPT_NETWORK !== "testnet") {
    throw new Error("No-charge project receipts require NEAR testnet.");
  }
  const adapter = createNearReceiptAdapter({
    network: "testnet",
    contractAccount: process.env.NEAR_RECEIPT_CONTRACT_ACCOUNT ?? "",
    signerAccount: process.env.NEAR_RECEIPT_SIGNER_ACCOUNT ?? "",
    signerPrivateKey: process.env.NEAR_RECEIPT_SIGNER_PRIVATE_KEY ?? "",
  });
  const unanchored = await db.customerPayment.findMany({
    where: {
      provider: "DEMO_SANDBOX",
      state: "ALLOCATED",
      project: { receipts: { none: { kind: "PROJECT", network: "testnet" } } },
    },
    include: { quote: true, project: true },
    take: 10,
  });
  for (const payment of unanchored) {
    if (!payment.project || !payment.quote.acceptedAt) continue;
    const proof = noChargeProjectProof(payment.project.id, {
      ...payment.quote,
      acceptedAt: payment.quote.acceptedAt,
    });
    await db.receiptAnchor.upsert({
      where: {
        network_kind_referenceHash: {
          network: "testnet",
          kind: "PROJECT",
          referenceHash: proof.referenceHash,
        },
      },
      create: {
        projectId: payment.project.id,
        kind: "PROJECT",
        network: "testnet",
        schemaVersion: 1,
        referenceHash: proof.referenceHash,
        canonicalRecordHash: proof.canonicalRecordHash,
      },
      update: {},
    });
  }
  const anchors = await db.receiptAnchor.findMany({
    where: {
      network: "testnet",
      kind: "PROJECT",
      state: { in: ["PENDING", "SUBMITTED", "RECONCILIATION_REQUIRED"] },
      project: {
        payments: { some: { provider: "DEMO_SANDBOX", state: "ALLOCATED" } },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true },
  });
  for (const anchor of anchors) {
    const result = await reconcileAndSubmitAnchor(db, adapter, anchor.id);
    if (result.kind === "CONFLICT") {
      console.error(`Project receipt hash conflict: ${anchor.id}`);
    }
  }
  return anchors.length;
}
