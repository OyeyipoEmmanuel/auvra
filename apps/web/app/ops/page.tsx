import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function OperatorHome() {
  const [projects, approvals, outbox, actions, recent, proposals] = await Promise.all([
    prisma.project.count(),
    prisma.approval.count({ where: { state: "PENDING" } }),
    prisma.outboxEvent.groupBy({ by: ["state"], _count: { _all: true } }),
    prisma.externalAction.groupBy({ by: ["state"], _count: { _all: true } }),
    prisma.auditEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: { id: true, eventType: true, projectId: true, occurredAt: true },
    }),
    prisma.supplierJob.findMany({
      where: { state: "PROPOSED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        currency: true,
        authorizedMinor: true,
        task: { select: { title: true } },
      },
    }),
  ]);
  const waiting = outbox
    .filter((item) => ["PENDING", "RETRY_PENDING"].includes(item.state))
    .reduce((sum, item) => sum + item._count._all, 0);
  const review = actions
    .filter((item) => ["UNKNOWN", "REVIEW_REQUIRED"].includes(item.state))
    .reduce((sum, item) => sum + item._count._all, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-[13px] font-semibold uppercase tracking-[.16em] text-violet-300">
        Operator only
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Operations</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-6 text-zinc-400">
        Recorded state from PostgreSQL. This page cannot authorize spending or change a project.
      </p>
      <nav
        aria-label="Operator sections"
        className="mt-7 flex flex-wrap gap-3 text-[14px]"
      >
        <Link
          href="/ops/treasury"
          className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
        >
          Treasury evidence
        </Link>
        <Link
          href="/ops/policies"
          className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
        >
          Policies and approvals
        </Link>
      </nav>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Projects"
          value={projects}
        />
        <Metric
          label="Pending approvals"
          value={approvals}
        />
        <Metric
          label="Outbox waiting"
          value={waiting}
        />
        <Metric
          label="Actions needing review"
          value={review}
        />
      </div>
      <p className="mt-7 rounded-xl border border-amber-600/30 bg-amber-500/5 p-5 text-[14px] leading-6 text-amber-100">
        No live hire is enabled by this screen. Verified funds, a current listing, an active policy,
        and an exact independent approval are separate requirements.
      </p>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Proposed supplier jobs</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {proposals.length ? (
            proposals.map((job) => (
              <Link
                key={job.id}
                href={`/ops/jobs/${job.id}`}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0 hover:bg-zinc-900"
              >
                <span>{job.task.title}</span>
                <span className="text-violet-300">
                  {job.currency} {job.authorizedMinor.toString()} minor units →
                </span>
              </Link>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No supplier proposals yet.</p>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent audit events</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {recent.length ? (
            recent.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0"
              >
                <div>
                  <p className="font-medium text-zinc-100">
                    {event.eventType.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-zinc-500">{event.occurredAt.toLocaleString()}</p>
                </div>
                {event.projectId && (
                  <span className="text-zinc-400">Project {event.projectId.slice(0, 8)}</span>
                )}
              </div>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No audit events yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-[14px] text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
