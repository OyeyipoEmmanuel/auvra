import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (user.role !== "OPERATOR" && user.role !== "ADMIN")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    pause?: unknown;
    expectedVersion?: unknown;
    reason?: unknown;
    confirmed?: unknown;
  } | null;
  if (
    !body ||
    typeof body.pause !== "boolean" ||
    !Number.isSafeInteger(body.expectedVersion) ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 10 ||
    body.reason.length > 500 ||
    body.confirmed !== true
  ) {
    return NextResponse.json({ error: "INVALID_POLICY_COMMAND" }, { status: 400 });
  }
  const pause = body.pause as boolean;
  const expectedVersion = body.expectedVersion as number;
  const reason = body.reason as string;
  if (!pause && (user.role !== "ADMIN" || process.env.AUVRA_RUNTIME_MODE !== "LIVE_MARKET")) {
    return NextResponse.json({ error: "RESUME_REQUIRES_LIVE_ADMIN" }, { status: 403 });
  }
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(8431189201)`;
    const current = await tx.policyVersion.findMany({
      where: { policyKey: "LIVE_PROCUREMENT", active: true },
      take: 2,
    });
    if (current.length !== 1 || current[0]?.version !== expectedVersion) return null;
    const policy = current[0];
    const rules = policy.rulesJson;
    if (
      !rules ||
      typeof rules !== "object" ||
      Array.isArray(rules) ||
      typeof rules.paused !== "boolean" ||
      rules.schemaVersion !== 1
    )
      return null;
    if (rules.paused === pause) return { version: policy.version, paused: pause };
    const nextVersion = policy.version + 1;
    await tx.policyVersion.update({ where: { id: policy.id }, data: { active: false } });
    const next = await tx.policyVersion.create({
      data: {
        policyKey: "LIVE_PROCUREMENT",
        version: nextVersion,
        rulesJson: { ...rules, paused: pause },
        active: true,
        createdById: user.id,
        activatedAt: new Date(),
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: pause ? "LIVE_PROCUREMENT_PAUSED" : "LIVE_PROCUREMENT_RESUMED",
        reason: reason.trim(),
        metadataJson: { previousPolicyId: policy.id, policyId: next.id, version: nextVersion },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "PolicyVersion",
        aggregateId: next.id,
        eventType: "policy.pause_changed",
        idempotencyKey: `policy:${next.id}:pause_changed`,
        payloadJson: { paused: pause, version: nextVersion },
      },
    });
    return { version: nextVersion, paused: pause };
  });
  return outcome
    ? NextResponse.json(outcome)
    : NextResponse.json({ error: "POLICY_VERSION_CONFLICT" }, { status: 409 });
}
