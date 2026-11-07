import { NextResponse } from "next/server";
import { draftRequestSchema, serviceRequestSchema } from "@auvra/contracts";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { withinRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const user = await getApiUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in is required.", 401);

  const requests = await prisma.serviceRequest.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      state: true,
      rawBrief: true,
      desiredOutcome: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in is required.", 401);
  if (!(await withinRateLimit("request-create", user.id, 30)))
    return apiError("RATE_LIMITED", "Too many requests. Try again shortly.", 429);

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 200)
    return apiError("INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.", 400);

  const body = await request.json().catch(() => null);
  const draft = body?.mode === "DRAFT";
  const parsed = (draft ? draftRequestSchema : serviceRequestSchema).safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "The request payload is invalid.",
          issues: parsed.error.issues,
        },
      },
      { status: 400 },
    );

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { scope_idempotencyKey: { scope: `request:create:${user.id}`, idempotencyKey } },
  });
  if (existing)
    return apiError("IDEMPOTENCY_CONFLICT", "This request key has already been used.", 409);

  const now = new Date();
  const state = draft ? "DRAFT" : "SUBMITTED";
  const result = await prisma
    .$transaction(async (tx) => {
      if (parsed.data.attachmentIds.length > 0) {
        const ownedFiles = await tx.storedFile.count({
          where: {
            id: { in: parsed.data.attachmentIds },
            ownerId: user.id,
            requestId: null,
            scanState: { in: ["VALIDATED", "CLEAN"] },
          },
        });
        if (ownedFiles !== parsed.data.attachmentIds.length)
          throw new RequestCommandError("INVALID_ATTACHMENTS");
      }

      await tx.idempotencyRecord.create({
        data: {
          scope: `request:create:${user.id}`,
          idempotencyKey,
          requestHash: await sha256(JSON.stringify(parsed.data)),
        },
      });
      const created = await tx.serviceRequest.create({
        data: {
          customerId: user.id,
          state,
          rawBrief: parsed.data.rawBrief,
          desiredOutcome: parsed.data.desiredOutcome,
          budgetMinor: parsed.data.budgetMinor ? BigInt(parsed.data.budgetMinor) : null,
          budgetCurrency: parsed.data.budgetCurrency,
          deadline: parsed.data.preferredDeadline ? new Date(parsed.data.preferredDeadline) : null,
          constraintsJson: parsed.data.constraints,
          submittedAt: draft ? null : now,
        },
        select: { id: true, state: true, rawBrief: true, createdAt: true },
      });

      if (parsed.data.attachmentIds.length > 0)
        await tx.storedFile.updateMany({
          where: { id: { in: parsed.data.attachmentIds }, ownerId: user.id },
          data: { requestId: created.id },
        });
      await tx.auditEvent.create({
        data: {
          actorType: "USER",
          actorId: user.id,
          eventType: draft ? "REQUEST_DRAFT_CREATED" : "REQUEST_SUBMITTED",
          requestId: created.id,
          metadataJson: { runtimeMode: process.env.AUVRA_RUNTIME_MODE ?? "DEMO_SANDBOX" },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "ServiceRequest",
          aggregateId: created.id,
          eventType: draft ? "request.draft_created" : "request.submitted",
          idempotencyKey: `request:${created.id}:${draft ? "draft-created" : "submitted"}:v1`,
          payloadJson: { requestId: created.id, customerId: user.id },
        },
      });
      await tx.idempotencyRecord.update({
        where: { scope_idempotencyKey: { scope: `request:create:${user.id}`, idempotencyKey } },
        data: { completedAt: now, statusCode: 201, responseJson: { requestId: created.id } },
      });
      return created;
    })
    .catch((error: unknown) => {
      if (error instanceof RequestCommandError) return null;
      throw error;
    });

  if (!result)
    return apiError(
      "INVALID_ATTACHMENTS",
      "One or more attachments are unavailable or not owned by this account.",
      400,
    );
  return NextResponse.json({ request: result }, { status: 201 });
}

class RequestCommandError extends Error {}

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
