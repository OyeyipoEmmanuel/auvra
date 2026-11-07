import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in is required." } },
      { status: 401 },
    );
  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, request: { customerId: user.id } },
    select: {
      id: true,
      state: true,
      expiresAt: true,
      requestId: true,
      version: true,
      currency: true,
      customerTotalMinor: true,
      request: { select: { budgetMinor: true, budgetCurrency: true } },
    },
  });
  if (!quote)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Quote not found." } },
      { status: 404 },
    );
  if (quote.state !== "PRESENTED" || quote.expiresAt <= new Date())
    return NextResponse.json(
      {
        error: {
          code: "QUOTE_UNAVAILABLE",
          message: "This quote is no longer available for acceptance.",
        },
      },
      { status: 409 },
    );

  const body = (await request.json().catch(() => null)) as {
    expectedTotalMinor?: unknown;
    acknowledgeOverBudget?: unknown;
  } | null;
  if (body?.expectedTotalMinor !== quote.customerTotalMinor.toString()) {
    return NextResponse.json(
      {
        error: {
          code: "PRICE_CHANGED",
          message: "The quote price changed. Review it again before accepting.",
        },
      },
      { status: 409 },
    );
  }
  const overBudget =
    quote.request.budgetMinor !== null &&
    (quote.request.budgetCurrency === quote.currency ||
      (process.env.AUVRA_RUNTIME_MODE === "DEMO_SANDBOX" &&
        ["USD", "USDC"].includes(quote.request.budgetCurrency ?? "") &&
        ["USD", "USDC"].includes(quote.currency))) &&
    quote.customerTotalMinor > quote.request.budgetMinor;
  if (overBudget && body.acknowledgeOverBudget !== true) {
    return NextResponse.json(
      {
        error: {
          code: "OVER_BUDGET_CONFIRMATION_REQUIRED",
          message: "Confirm the price above your budget before accepting.",
        },
      },
      { status: 409 },
    );
  }

  const accepted = await prisma.$transaction(async (tx) => {
    const quoteUpdate = await tx.quote.updateMany({
      where: { id, state: "PRESENTED", expiresAt: { gt: new Date() } },
      data: { state: "ACCEPTED", acceptedAt: new Date() },
    });
    if (quoteUpdate.count !== 1) return false;
    const requestUpdate = await tx.serviceRequest.updateMany({
      where: { id: quote.requestId, customerId: user.id, state: "QUOTED" },
      data: { state: "APPROVED", version: { increment: 1 } },
    });
    if (requestUpdate.count !== 1) throw new Error("REQUEST_STATE_CONFLICT");
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: "QUOTE_ACCEPTED",
        requestId: quote.requestId,
        metadataJson: {
          quoteId: id,
          version: quote.version,
          customerTotalMinor: quote.customerTotalMinor.toString(),
          aboveBudget: overBudget,
          overBudgetAcknowledged: overBudget && body.acknowledgeOverBudget === true,
        },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Quote",
        aggregateId: id,
        eventType: "quote.accepted",
        idempotencyKey: `quote:${id}:accepted`,
        payloadJson: { quoteId: id, requestId: quote.requestId },
      },
    });
    return true;
  });
  if (!accepted) {
    return NextResponse.json(
      {
        error: {
          code: "QUOTE_UNAVAILABLE",
          message: "This quote was already updated. Refresh and review it again.",
        },
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ accepted: true });
}
