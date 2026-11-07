import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (user.role !== "OPERATOR" && user.role !== "ADMIN")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (process.env.AUVRA_RUNTIME_MODE !== "LIVE_MARKET")
    return NextResponse.json({ error: "LIVE_MODE_REQUIRED" }, { status: 409 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    confirmed?: unknown;
    expectedAmountMinor?: unknown;
  } | null;
  const { id } = await params;
  const job = await prisma.supplierJob.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          payments: true,
          request: {
            include: {
              quotes: { where: { state: "ACCEPTED" }, orderBy: { version: "desc" }, take: 1 },
            },
          },
        },
      },
      task: true,
    },
  });
  if (!job) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (body?.confirmed !== true || body.expectedAmountMinor !== job.authorizedMinor.toString()) {
    return NextResponse.json({ error: "EXACT_PRICE_CONFIRMATION_REQUIRED" }, { status: 409 });
  }
  const quote = job.project.request.quotes[0];
  const payment = job.project.payments.find(
    (item) =>
      item.provider === "BACHS" &&
      item.quoteId === quote?.id &&
      item.currency === job.currency &&
      item.amountMinor === quote.customerTotalMinor &&
      item.verifiedAt &&
      ["VERIFIED", "ALLOCATED", "RECONCILED"].includes(item.state),
  );
  const snapshot = job.listingSnapshotJson;
  const observedAt =
    snapshot &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot) &&
    typeof snapshot.observedAt === "string"
      ? new Date(snapshot.observedAt)
      : null;
  if (
    !quote ||
    !payment ||
    job.state !== "PROPOSED" ||
    job.task.status !== "READY" ||
    !["PLANNING", "PROCUREMENT"].includes(job.project.state) ||
    !observedAt ||
    Number.isNaN(observedAt.getTime()) ||
    Date.now() - observedAt.getTime() > 15 * 60_000 ||
    job.currency !== "USD" ||
    job.authorizedMinor <= BigInt(0)
  ) {
    return NextResponse.json({ error: "PROPOSAL_NOT_READY" }, { status: 409 });
  }
  const policies = await prisma.policyVersion.findMany({
    where: { policyKey: "LIVE_PROCUREMENT", active: true },
    take: 2,
  });
  const policy = policies.length === 1 ? policies[0] : null;
  const rules = policy?.rulesJson;
  if (
    !policy ||
    !rules ||
    typeof rules !== "object" ||
    Array.isArray(rules) ||
    rules.paused !== false
  ) {
    return NextResponse.json({ error: "POLICY_UNAVAILABLE" }, { status: 409 });
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${job.projectId}::uuid FOR UPDATE`;
    const existing = await tx.approval.findFirst({
      where: { supplierJobId: job.id, state: "APPROVED", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing.id;
    const current = await tx.supplierJob.findUnique({ where: { id: job.id } });
    if (current?.state !== "PROPOSED" || current.authorizedMinor !== job.authorizedMinor)
      return null;
    const approval = await tx.approval.create({
      data: {
        approvalType: "FIRST_LIVE_HIRE",
        state: "APPROVED",
        decidedById: user.id,
        projectId: job.projectId,
        supplierJobId: job.id,
        policyVersionId: policy.id,
        amountMinor: job.authorizedMinor,
        currency: job.currency,
        reason: `Operator approved exact proposed job ${job.id} for ${job.authorizedMinor.toString()} ${job.currency}.`,
        decidedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        eventType: "SUPPLIER_JOB_APPROVED",
        projectId: job.projectId,
        supplierJobId: job.id,
        metadataJson: {
          approvalId: approval.id,
          amountMinor: job.authorizedMinor.toString(),
          currency: job.currency,
          policyVersionId: policy.id,
        },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Approval",
        aggregateId: approval.id,
        eventType: "approval.granted",
        idempotencyKey: `approval:${approval.id}:granted`,
        payloadJson: { projectId: job.projectId, supplierJobId: job.id },
      },
    });
    return approval.id;
  });
  return result
    ? NextResponse.json({ approved: true, approvalId: result })
    : NextResponse.json({ error: "PROPOSAL_CHANGED" }, { status: 409 });
}
