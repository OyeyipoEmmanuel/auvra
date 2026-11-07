import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  reconcileAndSubmitAnchor,
  type ReceiptAnchorAdapter,
} from "../apps/worker/src/receipts/anchor";

type AnchorFixture = {
  id: string;
  kind: "PROJECT";
  network: "testnet";
  referenceHash: string;
  canonicalRecordHash: string;
  providerReceiptHash: null;
  transactionHash: string | null;
  state: "PENDING" | "SUBMITTED" | "RECONCILIATION_REQUIRED";
};

const anchor: AnchorFixture = {
  id: "anchor-id",
  kind: "PROJECT",
  network: "testnet",
  referenceHash: "a".repeat(64),
  canonicalRecordHash: "b".repeat(64),
  providerReceiptHash: null,
  transactionHash: "tx-hash",
  state: "SUBMITTED",
};

function fixture(record: AnchorFixture) {
  const update = vi.fn().mockResolvedValue(undefined);
  const db = {
    receiptAnchor: { findUnique: vi.fn().mockResolvedValue(record), update },
  } as unknown as PrismaClient;
  const getProjectReceipt = vi.fn().mockResolvedValue(null);
  const recordProjectReceipt = vi.fn().mockResolvedValue({ transactionHash: "new-tx" });
  const adapter: ReceiptAnchorAdapter = {
    network: "testnet",
    contractAccount: "registry.testnet",
    signerAccount: "writer.testnet",
    getProjectReceipt,
    getSettlementReceipt: vi.fn().mockResolvedValue(null),
    getTransactionStatus: vi.fn().mockResolvedValue("PENDING"),
    recordProjectReceipt,
    recordSettlementReceipt: vi.fn().mockResolvedValue({ transactionHash: "new-tx" }),
  };
  return { db, adapter, update, getProjectReceipt, recordProjectReceipt };
}

describe("M6A restart and ambiguous submissions", () => {
  it("does not blindly resubmit when a transaction hash exists", async () => {
    const { db, adapter, update, recordProjectReceipt } = fixture(anchor);
    expect(await reconcileAndSubmitAnchor(db, adapter, anchor.id)).toEqual({
      kind: "AWAITING_CHAIN_RECONCILIATION",
    });
    expect(recordProjectReceipt).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "RECONCILIATION_REQUIRED" }),
      }),
    );
  });

  it("confirms an already-written matching receipt after restart", async () => {
    const { db, adapter, getProjectReceipt, recordProjectReceipt } = fixture(anchor);
    getProjectReceipt.mockResolvedValue({
      reference_hash: anchor.referenceHash,
      canonical_record_hash: anchor.canonicalRecordHash,
    });
    expect(await reconcileAndSubmitAnchor(db, adapter, anchor.id)).toEqual({ kind: "CONFIRMED" });
    expect(recordProjectReceipt).not.toHaveBeenCalled();
  });

  it("records a confirmed failed transaction without automatic resubmission", async () => {
    const { db, adapter, recordProjectReceipt, update } = fixture(anchor);
    vi.mocked(adapter.getTransactionStatus).mockResolvedValue("FAILURE");
    expect(await reconcileAndSubmitAnchor(db, adapter, anchor.id)).toEqual({
      kind: "FAILED_ON_CHAIN",
    });
    expect(recordProjectReceipt).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "FAILED" }),
      }),
    );
  });

  it("marks an uncertain send for reconciliation without retrying it", async () => {
    const { db, adapter, recordProjectReceipt, update } = fixture({
      ...anchor,
      transactionHash: null,
      state: "PENDING",
    });
    recordProjectReceipt.mockRejectedValue(new Error("RPC timeout after broadcast"));
    expect(await reconcileAndSubmitAnchor(db, adapter, anchor.id)).toEqual({
      kind: "AMBIGUOUS_SUBMISSION",
    });
    expect(recordProjectReceipt).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "RECONCILIATION_REQUIRED" }),
      }),
    );
  });
});
