import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";

import type { ReceiptAnchorAdapter } from "./anchor.js";

type Receipt = { reference_hash: string; canonical_record_hash: string };

export function createNearReceiptAdapter(config: {
  network: "testnet" | "mainnet";
  contractAccount: string;
  signerAccount: string;
  signerPrivateKey: string;
}): ReceiptAnchorAdapter {
  if (
    !config.contractAccount ||
    !config.signerAccount ||
    !/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(config.signerPrivateKey)
  )
    throw new Error("NEAR receipt signer configuration is incomplete.");
  const provider = new JsonRpcProvider({
    url:
      config.network === "testnet"
        ? "https://rpc.testnet.near.org"
        : "https://rpc.mainnet.near.org",
  });
  const signer = new Account(
    config.signerAccount,
    provider,
    config.signerPrivateKey as KeyPairString,
  );

  async function read(method: string, referenceHash: string): Promise<Receipt | null> {
    const value = await provider.callFunction<Receipt>({
      contractId: config.contractAccount,
      method,
      args: { reference_hash: referenceHash },
    });
    return value ?? null;
  }

  async function write(methodName: string, args: Record<string, string | number>) {
    const outcome = await signer.callFunctionRaw({
      contractId: config.contractAccount,
      methodName,
      args,
      gas: teraToGas("30"),
      deposit: BigInt(0),
      waitUntil: "FINAL",
    });
    const transaction = outcome as unknown as {
      transaction_outcome?: { id?: string };
      transaction?: { hash?: string };
    };
    const transactionHash = transaction.transaction_outcome?.id ?? transaction.transaction?.hash;
    if (!transactionHash)
      throw new Error("NEAR transaction hash was unavailable; reconcile before retry.");
    return { transactionHash };
  }

  return {
    network: config.network,
    contractAccount: config.contractAccount,
    signerAccount: config.signerAccount,
    getProjectReceipt: (referenceHash) => read("get_project_receipt", referenceHash),
    getSettlementReceipt: (referenceHash) => read("get_settlement_receipt", referenceHash),
    getTransactionStatus: async (transactionHash) => {
      try {
        const result = await provider.viewTransactionStatus({
          txHash: transactionHash,
          accountId: config.signerAccount,
          waitUntil: "FINAL",
        });
        const status = result.status;
        if (status && typeof status === "object" && "Failure" in status) return "FAILURE";
        if (
          status &&
          typeof status === "object" &&
          ("SuccessValue" in status || "SuccessReceiptId" in status)
        )
          return "SUCCESS";
        return "PENDING";
      } catch {
        return "UNKNOWN";
      }
    },
    recordProjectReceipt: (referenceHash, canonicalRecordHash) =>
      write("record_project_receipt", {
        schema_version: 1,
        reference_hash: referenceHash,
        canonical_record_hash: canonicalRecordHash,
      }),
    recordSettlementReceipt: (referenceHash, canonicalRecordHash, providerReceiptHash) =>
      write("record_settlement_receipt", {
        schema_version: 1,
        reference_hash: referenceHash,
        canonical_record_hash: canonicalRecordHash,
        provider_receipt_hash: providerReceiptHash,
      }),
  };
}
