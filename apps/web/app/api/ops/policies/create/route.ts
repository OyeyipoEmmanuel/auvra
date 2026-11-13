import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const positiveMinor = z.string().regex(/^[1-9]\d{0,17}$/);

const commandSchema = z.object({
  confirmed: z.literal(true),
  serviceIds: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
  perJobCapMinor: positiveMinor,
  projectCapMinor: positiveMinor,
  dailyCapMinor: positiveMinor,
  contributionFloorMinor: z.string().regex(/^\d{1,18}$/),
  reason: z.string().trim().min(10).max(500),
});

/** Creates only a paused policy; a second explicit admin action is required to resume it. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user?.id) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (
    !("role" in user) ||
    user.role !== "ADMIN" ||
    process.env.AUVRA_RUNTIME_MODE !== "LIVE_MARKET"
  ) {
    return NextResponse.json({ error: "LIVE_ADMIN_REQUIRED" }, { status: 403 });
  }
  const actorId = user.id;
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_POLICY" }, { status: 400 });
  const command = parsed.data;
  const serviceIds = [...new Set(command.serviceIds)];
  if (
    BigInt(command.perJobCapMinor) > BigInt(command.projectCapMinor) ||
    BigInt(command.perJobCapMinor) > BigInt(command.dailyCapMinor)
  )
    return NextResponse.json({ error: "INCONSISTENT_CAPS" }, { status: 400 });

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8431189201)`;
    const current = await tx.policyVersion.findMany({
      where: { policyKey: "LIVE_PROCUREMENT" },
      orderBy: { version: "desc" },
      take: 2,
    });
    const active = await tx.policyVersion.count({
      where: { policyKey: "LIVE_PROCUREMENT", active: true },
    });
    if (active > 0) return "ALREADY_ACTIVE" as const;
    const known = await tx.supplierJob.findMany({
      where: {
        provider: "NEAR_AGENT_MARKET",
        state: "PROPOSED",
        externalServiceId: { in: serviceIds },
      },
      select: { externalServiceId: true },
      distinct: ["externalServiceId"],
    });
    if (known.length !== serviceIds.length) return "UNKNOWN_SERVICE" as const;
    const policy = await tx.policyVersion.create({
      data: {
        policyKey: "LIVE_PROCUREMENT",
        version: (current[0]?.version ?? 0) + 1,
        active: true,
        createdById: actorId,
        activatedAt: new Date(),
        rulesJson: {
          schemaVersion: 1,
          paused: true,
          allowedCurrencies: ["USD"],
          allowedServices: serviceIds,
          perJobCapMinor: command.perJobCapMinor,
          projectCapMinor: command.projectCapMinor,
          dailyCapMinor: command.dailyCapMinor,
          autoApprovalCeilingMinor: "0",
          contributionFloorMinor: command.contributionFloorMinor,
          firstLiveHireRequiresApproval: true,
        },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId,
        eventType: "LIVE_PROCUREMENT_POLICY_CREATED_PAUSED",
        reason: command.reason,
        metadataJson: { policyId: policy.id, version: policy.version, serviceIds },
      },
    });
    return { policyId: policy.id, version: policy.version, paused: true };
  });

  if (outcome === "ALREADY_ACTIVE") {
    return NextResponse.json({ error: "POLICY_ALREADY_ACTIVE" }, { status: 409 });
  }
  if (outcome === "UNKNOWN_SERVICE") {
    return NextResponse.json({ error: "UNKNOWN_SUPPLIER_SERVICE" }, { status: 409 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
