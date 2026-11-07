import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { getApiUser } from "@/lib/authz";
import { analyzeServiceRequest, managerAnalysisSchema } from "@/lib/manager-analysis";
import { prisma } from "@/lib/prisma";
import { withinRateLimit } from "@/lib/rate-limit";
import { discoverSuppliersAndQuote } from "@/lib/supplier-discovery";

const revisionSchema = z.object({ change: z.string().trim().min(12).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return error("UNAUTHENTICATED", "Sign in is required.", 401);
  if (!(await withinRateLimit("quote-revise", user.id, 10)))
    return error("RATE_LIMITED", "Too many revisions. Try again shortly.", 429);
  const { id } = await params;
  const parsed = revisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return error(
      "INVALID_REVISION",
      "Describe the requested change in at least 12 characters.",
      400,
    );

  const quote = await prisma.quote.findFirst({
    where: { id, request: { customerId: user.id } },
    select: {
      id: true,
      state: true,
      version: true,
      request: {
        select: {
          id: true,
          state: true,
          rawBrief: true,
          desiredOutcome: true,
          constraintsJson: true,
          budgetMinor: true,
          budgetCurrency: true,
          deadline: true,
          answers: { select: { questionId: true, question: true, answer: true, round: true } },
          project: { select: { id: true } },
        },
      },
    },
  });
  if (!quote) return error("NOT_FOUND", "Quote not found.", 404);
  if (quote.request.project || quote.request.state !== "QUOTED" || quote.state !== "PRESENTED") {
    return error("QUOTE_UNAVAILABLE", "Only a presented, unfunded quote can be revised.", 409);
  }
  const constraints = Array.isArray(quote.request.constraintsJson)
    ? quote.request.constraintsJson.filter((value): value is string => typeof value === "string")
    : [];
  const analysis = managerAnalysisSchema.parse(
    analyzeServiceRequest({
      rawBrief: quote.request.rawBrief,
      desiredOutcome: quote.request.desiredOutcome,
      constraints,
      budgetMinor: quote.request.budgetMinor,
      budgetCurrency: quote.request.budgetCurrency,
      deadline: quote.request.deadline,
      answers: quote.request.answers,
      scopeRevision: parsed.data.change,
    }),
  );
  if (analysis.decision !== "SCOPED") {
    return error(
      "REVISION_NEEDS_DETAILS",
      "This scope change needs more detail before re-quoting.",
      400,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.quote.updateMany({
      where: { id, state: "PRESENTED" },
      data: { state: "SUPERSEDED" },
    });
    if (changed.count !== 1) return false;
    const moved = await tx.serviceRequest.updateMany({
      where: { id: quote.request.id, customerId: user.id, state: "QUOTED" },
      data: {
        state: "SCOPED",
        analysisJson: JSON.parse(JSON.stringify(analysis)) as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    if (moved.count !== 1) throw new Error("REQUEST_STATE_CONFLICT");
    await tx.supplierMatch.deleteMany({ where: { requestId: quote.request.id } });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: "QUOTE_SCOPE_REVISION_REQUESTED",
        requestId: quote.request.id,
        reason: parsed.data.change,
        metadataJson: { supersededQuoteId: id, quoteVersion: quote.version },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "ServiceRequest",
        aggregateId: quote.request.id,
        eventType: "request.scope_revised",
        idempotencyKey: `request:${quote.request.id}:scope-revised:quote-v${quote.version}`,
        payloadJson: { requestId: quote.request.id, supersededQuoteId: id },
      },
    });
    return true;
  });
  if (!result) return error("CONFLICT", "The quote changed while revising it.", 409);
  try {
    const next = await discoverSuppliersAndQuote(quote.request.id, user.id);
    return NextResponse.json({ revised: true, requestId: quote.request.id, result: next.kind });
  } catch {
    return NextResponse.json({
      revised: true,
      requestId: quote.request.id,
      result: "DISCOVERY_PENDING",
    });
  }
}

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
