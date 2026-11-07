import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    artifactIds?: unknown;
    confirmed?: unknown;
  } | null;
  if (
    !body ||
    body.confirmed !== true ||
    !Array.isArray(body.artifactIds) ||
    body.artifactIds.length === 0 ||
    body.artifactIds.length > 50 ||
    !body.artifactIds.every((value) => typeof value === "string" && uuid.test(value))
  ) {
    return NextResponse.json({ error: "INVALID_DELIVERY_DECISION" }, { status: 400 });
  }
  const artifactIds = [...new Set(body.artifactIds as string[])].sort();
  if (artifactIds.length !== body.artifactIds.length)
    return NextResponse.json({ error: "DUPLICATE_ARTIFACT" }, { status: 400 });
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const requestHash = createHash("sha256").update(JSON.stringify(artifactIds)).digest("hex");
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id}::uuid FOR UPDATE`;
    const project = await tx.project.findFirst({
      where: { id, customerId: user.id },
      include: {
        artifacts: true,
        qaReviews: { orderBy: { createdAt: "desc" } },
        tasks: true,
        supplierJobs: true,
      },
    });
    if (!project) return "NOT_FOUND" as const;
    const replay = await tx.idempotencyRecord.findUnique({
      where: {
        scope_idempotencyKey: { scope: "CUSTOMER_DELIVERY_ACCEPTANCE", idempotencyKey: id },
      },
    });
    if (replay)
      return replay.requestHash === requestHash && replay.completedAt
        ? ("ACCEPTED" as const)
        : ("CONFLICT" as const);
    if (
      project.state !== "CUSTOMER_REVIEW" ||
      project.artifacts.length !== artifactIds.length ||
      project.artifacts.some((artifact) => !artifactIds.includes(artifact.id)) ||
      project.tasks.some((task) => task.status !== "COMPLETED") ||
      project.supplierJobs.length === 0 ||
      project.supplierJobs.some((job) => job.state !== "ACCEPTED") ||
      project.artifacts.some(
        (artifact) =>
          project.qaReviews.find((review) => review.artifactId === artifact.id)?.result !==
          "PASSED",
      )
    ) {
      return "NOT_READY" as const;
    }
    const updated = await tx.project.updateMany({
      where: { id, customerId: user.id, state: "CUSTOMER_REVIEW", version: project.version },
      data: { state: "DELIVERED", deliveredAt: new Date(), version: { increment: 1 } },
    });
    if (updated.count !== 1) return "CONFLICT" as const;
    await tx.idempotencyRecord.create({
      data: {
        scope: "CUSTOMER_DELIVERY_ACCEPTANCE",
        idempotencyKey: id,
        requestHash,
        completedAt: new Date(),
        responseJson: { artifactIds },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: "CUSTOMER_DELIVERY_ACCEPTED",
        projectId: id,
        inputHash: requestHash,
        metadataJson: { artifactIds },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Project",
        aggregateId: id,
        eventType: "delivery.customer_accepted",
        idempotencyKey: `project:${id}:customer_accepted`,
        payloadJson: { projectId: id, artifactIds },
      },
    });
    return "ACCEPTED" as const;
  });
  if (result === "ACCEPTED") return NextResponse.json({ accepted: true });
  return NextResponse.json({ error: result }, { status: result === "NOT_FOUND" ? 404 : 409 });
}
