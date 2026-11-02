import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, { status: 401 });
  const { id } = await params;
  const quote = await prisma.quote.findFirst({ where: { id, request: { customerId: user.id } }, select: { id: true, state: true, requestId: true, version: true } });
  if (!quote) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quote not found." } }, { status: 404 });
  if (quote.state !== "PRESENTED") return NextResponse.json({ error: { code: "QUOTE_UNAVAILABLE", message: "This quote can no longer be rejected." } }, { status: 409 });

  const rejected = await prisma.$transaction(async (tx) => {
    const quoteUpdate = await tx.quote.updateMany({ where: { id, state: "PRESENTED" }, data: { state: "REJECTED" } });
    if (quoteUpdate.count !== 1) return false;
    const requestUpdate = await tx.serviceRequest.updateMany({ where: { id: quote.requestId, customerId: user.id, state: "QUOTED" }, data: { state: "SCOPED", version: { increment: 1 } } });
    if (requestUpdate.count !== 1) throw new Error("REQUEST_STATE_CONFLICT");
    await tx.auditEvent.create({ data: { actorType: "USER", actorId: user.id, eventType: "QUOTE_REJECTED", requestId: quote.requestId, metadataJson: { quoteId: id, version: quote.version } } });
    await tx.outboxEvent.create({ data: { aggregateType: "Quote", aggregateId: id, eventType: "quote.rejected", idempotencyKey: `quote:${id}:rejected`, payloadJson: { quoteId: id, requestId: quote.requestId } } });
    return true;
  });
  return NextResponse.json({ rejected });
}
