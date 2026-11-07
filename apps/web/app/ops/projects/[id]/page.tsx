import Link from "next/link";
import { notFound } from "next/navigation";

import { StateDot, formatMoney } from "@/components/workspace-ui";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { settlementReadiness } from "@/lib/settlement-readiness";

export default async function OperatorProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["OPERATOR", "ADMIN"]);
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      request: {
        include: {
          quotes: { where: { state: "ACCEPTED" }, orderBy: { version: "desc" }, take: 1 },
        },
      },
      tasks: { orderBy: { createdAt: "asc" } },
      payments: true,
      supplierJobs: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { createdAt: "desc" } },
      qaReviews: { orderBy: { createdAt: "desc" } },
      receipts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) notFound();
  const [journals, events] = await Promise.all([
    prisma.ledgerTransaction.findMany({
      where: { projectId: id },
      include: { entries: true },
      orderBy: { postedAt: "asc" },
    }),
    prisma.auditEvent.findMany({
      where: { projectId: id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: { id: true, eventType: true, occurredAt: true },
    }),
  ]);
  const readiness = settlementReadiness({
    quote: project.request.quotes[0] ?? null,
    payments: project.payments,
    jobs: project.supplierJobs,
    journals,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/ops"
        className="text-[14px] text-zinc-400 hover:text-white"
      >
        ← Operations
      </Link>
      <p className="mt-7 text-[13px] font-semibold uppercase tracking-[.14em] text-violet-300">
        Project {id.slice(0, 8)}
      </p>
      <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight">
        {project.request.rawBrief}
      </h1>
      <div className="mt-4">
        <StateDot state={project.state} />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Metric
          label="Tasks"
          value={`${project.tasks.filter((task) => task.status === "COMPLETED").length} / ${project.tasks.length}`}
        />
        <Metric
          label="Supplier jobs"
          value={String(project.supplierJobs.length)}
        />
        <Metric
          label="Accepted quote"
          value={
            project.request.quotes[0]
              ? formatMoney(
                  project.request.quotes[0].customerTotalMinor,
                  project.request.quotes[0].currency,
                )
              : "None"
          }
        />
      </div>
      <section className="mt-10 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold">Settlement readiness</h2>
        <p className="mt-2 text-[14px] leading-6 text-zinc-400">
          Local evidence check only. Even a clear result requires fresh provider confirmation and a
          verified chain transaction before final settlement is claimed.
        </p>
        {readiness.blockers.length ? (
          <ul className="mt-4 space-y-2 text-[14px] text-amber-200">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>• {blocker.replaceAll("_", " ")}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-emerald-300">
            Local evidence is ready for provider confirmation; not yet settled.
          </p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Supplier jobs</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {project.supplierJobs.length ? (
            project.supplierJobs.map((job) => (
              <Link
                key={job.id}
                href={`/ops/jobs/${job.id}`}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0 hover:bg-zinc-900"
              >
                <span>
                  {job.provider} · {job.id.slice(0, 8)}
                </span>
                <span>
                  {job.state} · {formatMoney(job.committedMinor, job.currency)} committed
                </span>
              </Link>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No supplier jobs.</p>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">QA and receipt evidence</h2>
        <p className="mt-3 text-[14px] text-zinc-400">
          {project.artifacts.length} artifacts · {project.qaReviews.length} QA reviews ·{" "}
          {project.receipts.filter((receipt) => receipt.state === "CONFIRMED").length} confirmed
          receipt anchors
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {project.artifacts.length ? (
            project.artifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/ops/artifacts/${artifact.id}`}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0 hover:bg-zinc-900"
              >
                <span>
                  {artifact.kind} · {artifact.id.slice(0, 8)}
                </span>
                <span className="text-zinc-400">
                  {project.qaReviews.find((review) => review.artifactId === artifact.id)?.result ??
                    "Awaiting QA"}
                </span>
              </Link>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No deliverables received.</p>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Audit timeline</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {events.length ? (
            events.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0"
              >
                <span>{event.eventType.replaceAll("_", " ")}</span>
                <time
                  dateTime={event.occurredAt.toISOString()}
                  className="text-zinc-400"
                >
                  {event.occurredAt.toLocaleString()}
                </time>
              </div>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No audit events.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-[14px] text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
