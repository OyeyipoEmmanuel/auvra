import Link from "next/link";
import { notFound } from "next/navigation";

import { OperatorApprovalButton } from "@/components/operator-approval-button";
import { StateDot, formatMoney } from "@/components/workspace-ui";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function OperatorJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["OPERATOR", "ADMIN"]);
  const { id } = await params;
  const [job, approvals] = await Promise.all([
    prisma.supplierJob.findUnique({
      where: { id },
      include: {
        task: { select: { title: true, objective: true, status: true } },
        project: {
          include: {
            request: { select: { rawBrief: true } },
            payments: {
              select: {
                provider: true,
                state: true,
                verifiedAt: true,
                amountMinor: true,
                currency: true,
              },
            },
          },
        },
      },
    }),
    prisma.approval.findMany({
      where: { supplierJobId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  if (!job) notFound();
  const snapshot =
    job.listingSnapshotJson &&
    typeof job.listingSnapshotJson === "object" &&
    !Array.isArray(job.listingSnapshotJson)
      ? (job.listingSnapshotJson as Record<string, unknown>)
      : {};
  const livePayment = job.project.payments.find(
    (payment) =>
      payment.provider === "BACHS" &&
      payment.verifiedAt &&
      ["VERIFIED", "ALLOCATED", "RECONCILED"].includes(payment.state),
  );
  const alreadyApproved = approvals.some(
    (approval) =>
      approval.state === "APPROVED" && approval.expiresAt && approval.expiresAt > new Date(),
  );
  const canReview =
    job.state === "PROPOSED" &&
    !alreadyApproved &&
    process.env.AUVRA_RUNTIME_MODE === "LIVE_MARKET";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/ops"
        className="text-[14px] text-zinc-400 hover:text-white"
      >
        ← Operations
      </Link>
      <p className="mt-7 text-[13px] font-semibold uppercase tracking-[.14em] text-violet-300">
        Supplier proposal
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{job.task.title}</h1>
      <div className="mt-4">
        <StateDot state={job.state} />
      </div>
      {job.autoAcceptAt && (
        <p className="mt-5 rounded-xl border border-amber-600/40 bg-amber-500/5 p-5 text-[14px] leading-6 text-amber-100">
          Marketplace auto-accept deadline: <strong>{job.autoAcceptAt.toLocaleString()}</strong>.
          Review the result and act on the marketplace before this time. Automated deadline alerts
          are not yet verified.
        </p>
      )}
      <Link
        href={`/ops/projects/${job.projectId}`}
        className="mt-4 inline-block text-[14px] text-violet-300 hover:text-white"
      >
        View project evidence →
      </Link>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card
          label="Agent"
          value={
            typeof snapshot.name === "string"
              ? snapshot.name
              : (job.externalAgentId ?? "Unverified")
          }
        />
        <Card
          label="Exact authorized price"
          value={formatMoney(job.authorizedMinor, job.currency)}
        />
        <Card
          label="Customer funding"
          value={
            livePayment
              ? `Verified ${formatMoney(livePayment.amountMinor, livePayment.currency)}`
              : "No verified live payment"
          }
        />
        <Card
          label="Task state"
          value={job.task.status}
        />
      </div>
      <section className="mt-8 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold">Scope to be shared</h2>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-zinc-300">
          {job.project.request.rawBrief}
        </p>
        <p className="mt-4 text-[14px] leading-6 text-zinc-400">
          Task objective: {job.task.objective}
        </p>
        {typeof snapshot.pageUrl === "string" &&
          snapshot.pageUrl.startsWith("https://market.near.ai/") && (
            <a
              href={snapshot.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-[14px] text-violet-300 hover:text-white"
            >
              Inspect live agent listing ↗
            </a>
          )}
      </section>
      <section className="mt-8 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold">Approval history</h2>
        {approvals.length ? (
          approvals.map((approval) => (
            <p
              key={approval.id}
              className="mt-3 text-[14px] text-zinc-300"
            >
              {approval.state} · {approval.id.slice(0, 8)} · {approval.createdAt.toLocaleString()}
            </p>
          ))
        ) : (
          <p className="mt-3 text-[14px] text-zinc-400">No approval recorded.</p>
        )}
      </section>
      {job.approvalUrl?.startsWith("https://market.near.ai/") && (
        <p className="mt-8 rounded-xl border border-amber-600/30 bg-amber-500/5 p-5 text-[14px] leading-6 text-amber-100">
          A marketplace draft exists. Opening its approval page and confirming there can charge the
          marketplace buyer wallet. Do not proceed without reviewing the exact provider price and
          terms.{" "}
          <a
            href={job.approvalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 underline"
          >
            Open draft ↗
          </a>
        </p>
      )}
      {canReview && (
        <OperatorApprovalButton
          jobId={job.id}
          priceMinor={job.authorizedMinor.toString()}
          label={formatMoney(job.authorizedMinor, job.currency)}
        />
      )}
      {!canReview && job.state === "PROPOSED" && (
        <p className="mt-7 text-[14px] text-amber-200">
          Approvals are unavailable outside live mode or while a valid approval already exists.
        </p>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-[14px] text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
