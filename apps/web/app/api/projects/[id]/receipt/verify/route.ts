import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getNoChargeProjectReceipt, localNoChargeProof } from "@/lib/project-receipt";

type ChainRecord = { reference_hash: string; canonical_record_hash: string };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  const { id } = await params;
  const receipt = await getNoChargeProjectReceipt(id, user.id);
  if (!receipt) return NextResponse.json({ message: "Receipt not found." }, { status: 404 });
  const anchor = receipt.anchor;
  const localProof = localNoChargeProof(receipt);
  if (!anchor || !localProof || anchor.canonicalRecordHash !== localProof.canonicalRecordHash) {
    return NextResponse.json(
      { message: "The project receipt record does not match." },
      { status: 409 },
    );
  }
  const contractAccount = anchor?.contractAccount ?? process.env.NEAR_RECEIPT_CONTRACT_ACCOUNT;
  if (!contractAccount || anchor.network !== "testnet") {
    return NextResponse.json({
      verified: false,
      message: "Onchain verification is not ready yet.",
    });
  }
  if (!/^[a-z0-9._-]+\.testnet$/.test(contractAccount)) {
    return NextResponse.json({ message: "Testnet contract is not configured." }, { status: 503 });
  }

  try {
    const args = Buffer.from(JSON.stringify({ reference_hash: anchor.referenceHash })).toString(
      "base64",
    );
    const response = await fetch("https://rpc.testnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "auvra-project-receipt",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: contractAccount,
          method_name: "get_project_receipt",
          args_base64: args,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("RPC unavailable");
    const result = (await response.json()) as {
      error?: unknown;
      result?: { result?: number[] };
    };
    if (result.error || !result.result?.result) throw new Error("RPC query failed");
    const chain = JSON.parse(
      Buffer.from(result.result.result).toString("utf8"),
    ) as ChainRecord | null;
    if (!chain) {
      return NextResponse.json({
        verified: false,
        message: "The transaction is not confirmed yet.",
      });
    }
    if (
      chain.reference_hash !== anchor.referenceHash ||
      chain.canonical_record_hash !== anchor.canonicalRecordHash
    ) {
      return NextResponse.json({ message: "The onchain record does not match." }, { status: 409 });
    }
    await prisma.receiptAnchor.update({
      where: { id: anchor.id },
      data: {
        state: "CONFIRMED",
        contractAccount,
        confirmedAt: anchor.confirmedAt ?? new Date(),
        lastReconciledAt: new Date(),
      },
    });
    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { message: "NEAR testnet could not be reached. Please try again shortly." },
      { status: 503 },
    );
  }
}
