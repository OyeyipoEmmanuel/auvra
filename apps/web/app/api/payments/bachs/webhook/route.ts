import { NextResponse } from "next/server";

import { verifyBachsSignature } from "@/lib/bachs";
import { processBachsCollection, processBachsRiskEvent } from "@/lib/live-funding";
import { bachsPaymentMode } from "@/lib/payment-config";

export async function POST(request: Request) {
  if (!bachsPaymentMode())
    return NextResponse.json({ error: "Bachs payment rail is disabled." }, { status: 503 });
  const rawBytes = Buffer.from(await request.arrayBuffer());
  const rawBody = rawBytes.toString("utf8");
  const secret = process.env.BACHS_WEBHOOK_SECRET;
  if (
    !secret ||
    !verifyBachsSignature(rawBytes, request.headers.get("x-bachs-signature-v2"), secret)
  )
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const risk = await processBachsRiskEvent(rawBody, event);
  const result = risk.kind === "IGNORED" ? await processBachsCollection(rawBody, event) : risk;
  if (
    result.kind === "VERIFICATION_MISMATCH" ||
    result.kind === "UNKNOWN_REFERENCE" ||
    result.kind === "UNMATCHED_RISK_EVENT"
  )
    return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
