import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";

import { StateDot, WorkspaceEmpty, formatMoney } from "@/components/workspace-ui";
import { CustomerDeliveryAccept } from "@/components/customer-delivery-accept";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, customerId: user.id },
    include: {
      request: { select: { id: true, rawBrief: true } },
      tasks: {
        orderBy: { createdAt: "asc" },
        include: { supplierJobs: { select: { id: true, provider: true, state: true } } },
      },
      payments: {
        select: {
          id: true,
          provider: true,
          state: true,
          currency: true,
          amountMinor: true,
          allocatedAt: true,
        },
      },
      supplierJobs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          externalServiceId: true,
          state: true,
          committedMinor: true,
          settledMinor: true,
          currency: true,
        },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, externalUrl: true, createdAt: true },
      },
      qaReviews: {
        orderBy: { createdAt: "desc" },
        select: { id: true, artifactId: true, result: true, createdAt: true },
      },
    },
  });
  if (!project) notFound();
  const timeline = await prisma.auditEvent.findMany({
    where: { projectId: project.id },
    orderBy: { occurredAt: "desc" },
    take: 30,
    select: { id: true, eventType: true, occurredAt: true },
  });
  const demoPayment = project.payments.find((payment) =>
    ["DEMO_SANDBOX", "BACHS_SANDBOX"].includes(payment.provider),
  );
  const completed = project.tasks.filter((task) => task.status === "COMPLETED").length;
  const hired = project.supplierJobs.filter((job) =>
    [
      "HIRED",
      "ACTIVE",
      "SUBMITTED",
      "QA_PASSED",
      "QA_FAILED",
      "REVISION_REQUESTED",
      "ACCEPTED",
    ].includes(job.state),
  ).length;
  const deliveryReady =
    project.state === "CUSTOMER_REVIEW" &&
    project.artifacts.length > 0 &&
    project.artifacts.every(
      (artifact) =>
        project.qaReviews.find((review) => review.artifactId === artifact.id)?.result === "PASSED",
    ) &&
    project.supplierJobs.length > 0 &&
    project.supplierJobs.every((job) => job.state === "ACCEPTED") &&
    project.tasks.every((task) => task.status === "COMPLETED");
  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link
        href="/app/projects"
        className="inline-flex items-center gap-1.5 text-[14px] text-[#85858e] hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Projects
      </Link>
      <div className="mt-7 flex flex-wrap items-start justify-between gap-5 border-b border-[var(--ws-border)] pb-7">
        <div className="min-w-0">
          <p className="text-[13px] font-medium uppercase tracking-[.12em] text-[#777780]">
            Project {project.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-2 line-clamp-2 max-w-3xl text-[28px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
            {project.request.rawBrief}
          </h1>
          <div className="mt-4">
            <StateDot state={project.state} />
          </div>
        </div>
        <Link
          href={`/app/requests/${project.request.id}`}
          className="inline-flex items-center gap-1 text-[14px] text-[#a78bfa] hover:text-white"
        >
          Original request
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      {demoPayment && (
        <div className="mt-7 flex items-start gap-3 rounded-lg border border-[#4a3a25] bg-[#1b1712] p-4 text-[14px] leading-5 text-[#c6b7a2]">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold text-[#f2dfbd]">Development sandbox.</span>{" "}
            {formatMoney(demoPayment.amountMinor, demoPayment.currency)} was recorded as simulated
            funding. No wallet transfer or marketplace hire occurred.
          </p>
        </div>
      )}
      <section
        aria-label="Project summary"
        className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--ws-border)] bg-[var(--ws-border)] sm:grid-cols-4"
      >
        <Summary
          label="Tasks"
          value={`${completed} / ${project.tasks.length}`}
        />
        <Summary
          label="Agents hired"
          value={String(hired)}
        />
        <Summary
          label="Deliverables"
          value={String(project.artifacts.length)}
        />
        <Summary
          label="Started"
          value={project.startedAt ? project.startedAt.toLocaleDateString() : "Not started"}
        />
      </section>
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="tasks-title">
            <div className="flex items-baseline justify-between">
              <h2
                id="tasks-title"
                className="text-[15px] font-semibold"
              >
                Milestones & tasks
              </h2>
              <span className="text-[13px] text-[#777780]">{project.tasks.length} planned</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
              {project.tasks.length ? (
                project.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="flex gap-4 border-b border-[var(--ws-border)] px-4 py-4 last:border-0"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border border-[#39393d] bg-[#1a1a1c] text-[13px] text-[#a78bfa]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[14px] font-medium text-[#e8e8eb]">{task.title}</h3>
                        <StateDot state={task.status} />
                      </div>
                      <p className="mt-1 text-[14px] leading-5 text-[#92929b]">{task.objective}</p>
                      <p className="mt-3 text-[13px] text-[#777780]">
                        {task.supplierJobs.length
                          ? `${task.supplierJobs.length} agent job(s)`
                          : "No agent hired"}{" "}
                        · Observed supplier cost{" "}
                        {formatMoney(task.budgetMinor, task.budgetCurrency)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <WorkspaceEmpty
                  title="No tasks recorded"
                  description="The project plan has no tasks to show."
                />
              )}
            </div>
          </section>
          <section aria-labelledby="deliverables-title">
            <h2
              id="deliverables-title"
              className="text-[15px] font-semibold"
            >
              Deliverables
            </h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
              {project.artifacts.length ? (
                project.artifacts.map((artifact) => {
                  const review = project.qaReviews.find((item) => item.artifactId === artifact.id);
                  const releaseReady =
                    review?.result === "PASSED" &&
                    ["CUSTOMER_REVIEW", "DELIVERED", "CLOSED"].includes(project.state) &&
                    (artifact.kind !== "MARKETPLACE_EXTERNAL" ||
                      project.supplierJobs.some((job) => job.state === "ACCEPTED"));
                  return (
                    <div
                      key={artifact.id}
                      className="flex items-center justify-between gap-4 border-b border-[var(--ws-border)] px-4 py-3.5 last:border-0"
                    >
                      <div>
                        <p className="text-[14px] font-medium text-[#e4e4e7]">{artifact.kind}</p>
                        <p className="mt-1 text-[13px] text-[#777780]">
                          Added {artifact.createdAt.toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-[13px] text-[#a1a1aa]">
                          {releaseReady
                            ? "Quality review passed"
                            : review
                              ? `Quality review: ${review.result}`
                              : "Awaiting quality review"}
                        </p>
                      </div>
                      {releaseReady &&
                        artifact.externalUrl &&
                        /^https:\/\//i.test(artifact.externalUrl) && (
                          <a
                            href={artifact.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[14px] text-[#a78bfa] hover:text-white"
                          >
                            Open <ArrowUpRight className="inline size-3" />
                          </a>
                        )}
                    </div>
                  );
                })
              ) : (
                <WorkspaceEmpty
                  title="No deliverables yet"
                  description="Supplier outputs will appear here after they are received and checked."
                />
              )}
            </div>
          </section>
          {deliveryReady && (
            <CustomerDeliveryAccept
              projectId={project.id}
              artifactIds={project.artifacts.map((artifact) => artifact.id)}
            />
          )}
          <section aria-labelledby="timeline-title">
            <h2
              id="timeline-title"
              className="text-[15px] font-semibold"
            >
              Project timeline
            </h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
              {timeline.length ? (
                timeline.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-wrap justify-between gap-3 border-b border-[var(--ws-border)] px-4 py-3 text-[14px] last:border-0"
                  >
                    <span className="text-[#e4e4e7]">{event.eventType.replaceAll("_", " ")}</span>
                    <time
                      className="text-[#85858e]"
                      dateTime={event.occurredAt.toISOString()}
                    >
                      {event.occurredAt.toLocaleString()}
                    </time>
                  </div>
                ))
              ) : (
                <p className="p-4 text-[14px] text-[#85858e]">No project events recorded yet.</p>
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-8">
          <section>
            <h2 className="text-[15px] font-semibold">Agents</h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
              {project.supplierJobs.length ? (
                project.supplierJobs.map((job) => (
                  <div
                    key={job.id}
                    className="border-b border-[var(--ws-border)] p-4 last:border-0"
                  >
                    <p className="text-[14px] font-medium text-[#e4e4e7]">
                      {job.provider} · {job.externalServiceId}
                    </p>
                    <div className="mt-2">
                      <StateDot state={job.state} />
                    </div>
                    <p className="mt-2 text-[13px] text-[#85858e]">
                      Committed {formatMoney(job.committedMinor, job.currency)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="p-4 text-[14px] leading-5 text-[#92929b]">
                  No agents hired. Supplier matches on a quote are observations only.
                </p>
              )}
            </div>
          </section>
          <section className="border-t border-[var(--ws-border)] pt-6">
            <h2 className="text-[15px] font-semibold">Financial status</h2>
            <dl className="mt-4 space-y-3 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#85858e]">Funding</dt>
                <dd>{demoPayment ? "Simulated" : "No payment record"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#85858e]">Supplier spending</dt>
                <dd>{project.supplierJobs.length ? "See agents" : "None recorded"}</dd>
              </div>
            </dl>
            <Link
              href="/app/treasury"
              className="mt-4 inline-block text-[14px] text-[#a78bfa] hover:text-white"
            >
              View treasury →
            </Link>
          </section>
          <div className="border-t border-[var(--ws-border)] pt-5 text-[14px] leading-5 text-[#85858e]">
            Execution is paused until supplier procurement, funding verification, and spend
            approvals are available.
          </div>
        </aside>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--ws-surface)] p-4">
      <dt className="text-[13px] text-[#85858e]">{label}</dt>
      <dd className="mt-2 text-[15px] font-semibold text-[#ededf0]">{value}</dd>
    </div>
  );
}
