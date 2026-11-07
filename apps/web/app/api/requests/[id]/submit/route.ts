import { NextResponse } from "next/server";
import { serviceRequestSchema } from "@auvra/contracts";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return error("UNAUTHENTICATED", "Sign in is required.", 401);
  const { id } = await params;
  const parsed = serviceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("INVALID_REQUEST", "The submitted request is invalid.", 400);

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.serviceRequest.findFirst({
      where: { id, customerId: user.id },
      select: { state: true, version: true },
    });
    if (!current) return "NOT_FOUND" as const;
    if (current.state !== "DRAFT") return "INVALID_STATE" as const;
    const attachments = parsed.data.attachmentIds;
    const available = await tx.storedFile.count({
      where: {
        id: { in: attachments },
        ownerId: user.id,
        scanState: { in: ["VALIDATED", "CLEAN"] },
        OR: [{ requestId: null }, { requestId: id }],
      },
    });
    if (available !== attachments.length) return "INVALID_ATTACHMENTS" as const;

    const now = new Date();
    const updated = await tx.serviceRequest.updateMany({
      where: { id, customerId: user.id, state: "DRAFT", version: current.version },
      data: {
        state: "SUBMITTED",
        rawBrief: parsed.data.rawBrief,
        desiredOutcome: parsed.data.desiredOutcome ?? null,
        budgetMinor: parsed.data.budgetMinor ? BigInt(parsed.data.budgetMinor) : null,
        budgetCurrency: parsed.data.budgetCurrency ?? null,
        deadline: parsed.data.preferredDeadline ? new Date(parsed.data.preferredDeadline) : null,
        constraintsJson: parsed.data.constraints,
        submittedAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return "CONFLICT" as const;
    await tx.storedFile.updateMany({
      where: { requestId: id, ownerId: user.id, id: { notIn: attachments } },
      data: { requestId: null },
    });
    if (attachments.length) {
      await tx.storedFile.updateMany({
        where: { id: { in: attachments }, ownerId: user.id },
        data: { requestId: id },
      });
    }
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: "REQUEST_SUBMITTED",
        requestId: id,
        metadataJson: { fromDraft: true },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "ServiceRequest",
        aggregateId: id,
        eventType: "request.submitted",
        idempotencyKey: `request:${id}:submitted:v1`,
        payloadJson: { requestId: id, customerId: user.id },
      },
    });
    return "SUBMITTED" as const;
  });

  if (result === "NOT_FOUND") return error("NOT_FOUND", "Request not found.", 404);
  if (result !== "SUBMITTED") return error(result, "The draft could not be submitted.", 409);
  return NextResponse.json({ request: { id, state: "SUBMITTED" } });
}

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
