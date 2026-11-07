import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { WorkspaceEmpty, WorkspaceHeader, StateDot, formatMoney } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { getCustomerOverview } from "@/lib/customer-overview";

export default async function CustomerHome() {
  const user = await requirePageUser();
  const {
    requests,
    projects,
    projectCount,
    activeProjectCount,
    quoteReadyCount,
    notifications,
    livePayments,
  } = await getCustomerOverview(user.id);
  const attention = requests.filter((request) =>
    ["NEEDS_CLARIFICATION", "QUOTED", "APPROVED"].includes(request.state),
  );
  const activeProjects = projects.filter(
    (project) => !["CLOSED", "CANCELLED", "FAILED", "DELIVERED"].includes(project.state),
  );
  const totalLive =
    livePayments.length > 0 &&
    livePayments.every((payment) => payment.currency === livePayments[0].currency)
      ? formatMoney(
          livePayments.reduce((total, payment) => total + payment.amountMinor, BigInt(0)),
          livePayments[0].currency,
        )
      : null;

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Overview"
        description="Your requests, projects, and decisions in one place."
        action={
          <Link
            href="/app/requests/new"
            className="inline-flex h-9 self-start items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            <Plus className="size-3.5" />
            New request
          </Link>
        }
      />

      <section
        aria-label="Workspace summary"
        className="grid grid-cols-2 border-b border-[var(--ws-border)] py-7 sm:grid-cols-4"
      >
        <Metric
          label="Active projects"
          value={String(activeProjectCount)}
          detail={`${projectCount} total projects`}
        />
        <Metric
          label="Needs attention"
          value={String(attention.length)}
          detail={`${quoteReadyCount} quotes ready`}
        />
        <Metric
          label="Customer payments"
          value={totalLive ?? "—"}
          detail={livePayments.length ? "Verified live payments" : "No verified live payments"}
        />
        <Metric
          label="Supplier spending"
          value="—"
          detail="No settled supplier costs"
          last
        />
      </section>

      <div className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="active-work">
            <SectionTitle
              id="active-work"
              title="Active work"
              count={activeProjectCount}
              href="/app/projects"
            />
            {activeProjects.length ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
                <div className="hidden grid-cols-[minmax(0,1fr)_110px_130px_110px] gap-4 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-4 py-3 text-[13px] text-[#777780] md:grid">
                  <span>Project</span>
                  <span>Status</span>
                  <span>Agents</span>
                  <span className="text-right">Updated</span>
                </div>
                {activeProjects.map((project) => (
                  <Link
                    href={`/app/projects/${project.id}`}
                    key={project.id}
                    className="grid gap-2 border-b border-[var(--ws-border)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[#171719] md:grid-cols-[minmax(0,1fr)_110px_130px_110px] md:items-center md:gap-4"
                  >
                    <span className="min-w-0 truncate text-[14px] font-medium text-[#e8e8eb]">
                      {project.request.rawBrief}
                    </span>
                    <StateDot state={project.state} />
                    <span className="text-[14px] text-[#85858e]">
                      {project.supplierJobs.length
                        ? `${project.supplierJobs.length} hired`
                        : "None hired"}
                    </span>
                    <span className="text-[14px] text-[#777780] md:text-right">
                      {project.updatedAt.toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-[var(--ws-border)]">
                <WorkspaceEmpty
                  title="No active projects"
                  description="A project appears here after you approve a quote and complete its funding step."
                  href="/app/requests"
                  action="View requests"
                />
              </div>
            )}
          </section>

          <section aria-labelledby="recent-requests">
            <SectionTitle
              id="recent-requests"
              title="Recent requests"
              count={requests.length}
              href="/app/requests"
            />
            {requests.length ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
                {requests.map((request) => (
                  <Link
                    key={request.id}
                    href={`/app/requests/${request.id}`}
                    className="flex flex-col gap-2 border-b border-[var(--ws-border)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[#171719] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#e8e8eb]">
                        {request.rawBrief}
                      </p>
                      <p className="mt-1 text-[13px] text-[#777780]">
                        Updated {request.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <StateDot state={request.state} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-[var(--ws-border)]">
                <WorkspaceEmpty
                  title="No requests yet"
                  description="Describe the outcome you need. Auvra will assess the work and prepare a scope before any spending."
                  href="/app/requests/new"
                  action="Create a request"
                />
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-9">
          <section aria-labelledby="attention-title">
            <h2
              id="attention-title"
              className="text-[15px] font-semibold tracking-[-.02em]"
            >
              Attention required
            </h2>
            <p className="mt-1 text-[14px] text-[#777780]">Decisions that need your input</p>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
              {attention.length ? (
                attention.map((request) => (
                  <Link
                    key={request.id}
                    href={`/app/requests/${request.id}`}
                    className="block border-b border-[var(--ws-border)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[#171719]"
                  >
                    <p className="truncate text-[14px] font-medium text-[#e4e4e7]">
                      {request.rawBrief}
                    </p>
                    <p className="mt-1 text-[13px] text-[#a1a1aa]">
                      {request.state === "QUOTED"
                        ? "Review quote"
                        : request.state === "APPROVED"
                          ? "Complete demo funding"
                          : "Answer clarification"}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-5 text-[14px] leading-5 text-[#85858e]">
                  Nothing needs your input right now.
                </p>
              )}
            </div>
          </section>
          <section aria-labelledby="activity-title">
            <div className="flex items-center justify-between">
              <h2
                id="activity-title"
                className="text-[15px] font-semibold tracking-[-.02em]"
              >
                Recent activity
              </h2>
              <Link
                href="/app/activity"
                className="text-[13px] text-[#a78bfa] hover:text-white"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 border-l border-[var(--ws-border)] pl-4">
              {notifications.length ? (
                notifications.map((event) => (
                  <div
                    key={event.id}
                    className="relative pb-5 last:pb-0"
                  >
                    <span className="absolute -left-[19px] top-1.5 size-2 rounded-full border border-[#4b4b50] bg-[#141414]" />
                    <p className="text-[14px] font-medium text-[#dedee1]">{event.title}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#85858e]">
                      {event.body}
                    </p>
                    <time className="mt-1 block text-[12px] text-[#66666e]">
                      {event.createdAt.toLocaleString()}
                    </time>
                  </div>
                ))
              ) : (
                <p className="text-[14px] leading-5 text-[#85858e]">
                  Activity will appear when your requests change state.
                </p>
              )}
            </div>
          </section>
          <div className="border-t border-[var(--ws-border)] pt-5 text-[14px] leading-5 text-[#85858e]">
            <span className="font-medium text-[#c5c5ca]">Development sandbox</span>
            <p className="mt-1">
              Funding is simulated. Supplier hiring and live settlement are not enabled.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  last = false,
}: {
  label: string;
  value: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div
      className={`min-w-0 py-2 pr-4 sm:pl-6 ${last ? "" : "sm:border-r sm:border-[var(--ws-border)]"} first:pl-0`}
    >
      <p className="text-[13px] font-medium text-[#92929b]">{label}</p>
      <p className="mt-2 truncate text-[24px] font-semibold tracking-[-.045em] text-[#f5f5f6]">
        {value}
      </p>
      <p className="mt-1 text-[13px] text-[#696971]">{detail}</p>
    </div>
  );
}

function SectionTitle({
  id,
  title,
  count,
  href,
}: {
  id: string;
  title: string;
  count: number;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        id={id}
        className="text-[15px] font-semibold tracking-[-.02em]"
      >
        {title} <span className="ml-1 text-[14px] font-normal text-[#777780]">{count}</span>
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[13px] text-[#a78bfa] hover:text-white"
      >
        View all
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
