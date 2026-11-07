import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (user.role !== "OPERATOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as {
    decision?: unknown;
    passedChecks?: unknown;
    notes?: unknown;
  } | null;
  if (
    !body ||
    !["PASSED", "REJECTED"].includes(String(body.decision)) ||
    !Array.isArray(body.passedChecks) ||
    !body.passedChecks.every((check) => typeof check === "string") ||
    typeof body.notes !== "string" ||
    body.notes.trim().length < 10 ||
    body.notes.length > 4000
  ) {
    return NextResponse.json({ error: "INVALID_REVIEW" }, { status: 400 });
  }
  const decision = body.decision as "PASSED" | "REJECTED";
  const passedChecks = body.passedChecks as string[];
  const notes = body.notes.trim();
  const result = await prisma.$transaction(async (tx) => {
    const artifact = await tx.artifact.findUnique({ where: { id } });
    if (!artifact?.supplierJobId) return "NOT_FOUND" as const;
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${artifact.projectId}::uuid FOR UPDATE`;
    const job = await tx.supplierJob.findUnique({
      where: { id: artifact.supplierJobId },
      include: { task: true },
    });
    const latest = await tx.qaReview.findFirst({
      where: { artifactId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!job || job.state !== "SUBMITTED" || latest?.result !== "NEEDS_QUALITATIVE_REVIEW") {
      return "NOT_READY" as const;
    }
    const evidence = latest.evidenceJson;
    const checks =
      evidence &&
      typeof evidence === "object" &&
      !Array.isArray(evidence) &&
      Array.isArray(evidence.acceptanceChecks) &&
      evidence.acceptanceChecks.every((check) => typeof check === "string")
        ? (evidence.acceptanceChecks as string[])
        : [];
    if (
      checks.length === 0 ||
      new Set(passedChecks).size !== passedChecks.length ||
      passedChecks.some((check) => !checks.includes(check)) ||
      (decision === "PASSED" && passedChecks.length !== checks.length) ||
      (decision === "REJECTED" && passedChecks.length === checks.length)
    ) {
      return "CHECKLIST_MISMATCH" as const;
    }
    const review = await tx.qaReview.create({
      data: {
        projectId: artifact.projectId,
        artifactId: id,
        policyVersion: "M9_HUMAN_V1",
        result: decision,
        evidenceJson: {
          reviewerId: user.id,
          checks,
          passedChecks,
          notes,
          priorReviewId: latest.id,
        },
        violationsJson: checks.filter((check) => !passedChecks.includes(check)),
      },
    });
    await tx.supplierJob.update({
      where: { id: job.id },
      data: { state: decision === "PASSED" ? "QA_PASSED" : "QA_FAILED", version: { increment: 1 } },
    });
    await tx.project.updateMany({
      where: { id: artifact.projectId, state: { in: ["RUNNING", "QA"] } },
      data: { state: decision === "PASSED" ? "QA" : "REVISION", version: { increment: 1 } },
    });
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ id, decision, passedChecks, notes }))
      .digest("hex");
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: "ARTIFACT_QUALITATIVE_REVIEWED",
        projectId: artifact.projectId,
        supplierJobId: job.id,
        inputHash,
        metadataJson: { artifactId: id, reviewId: review.id, decision },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Artifact",
        aggregateId: id,
        eventType: "qa.qualitative_completed",
        idempotencyKey: `artifact:${id}:qualitative:${review.id}`,
        payloadJson: { projectId: artifact.projectId, supplierJobId: job.id, decision },
      },
    });
    return "RECORDED" as const;
  });
  if (result === "RECORDED") return NextResponse.json({ recorded: true, decision });
  return NextResponse.json({ error: result }, { status: result === "NOT_FOUND" ? 404 : 409 });
}
