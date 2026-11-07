import Link from "next/link";
import { StateDot, WorkspaceEmpty, WorkspaceHeader, formatMoney } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function AgentsPage() {
  const user = await requirePageUser();
  const jobs = await prisma.supplierJob.findMany({
    where: { project: { customerId: user.id } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      state: true,
      provider: true,
      externalServiceId: true,
      externalJobId: true,
      authorizedMinor: true,
      committedMinor: true,
      settledMinor: true,
      currency: true,
      updatedAt: true,
      project: { select: { id: true, request: { select: { rawBrief: true } } } },
    },
  });
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Agents"
        description="Specialists hired by Auvra for your projects. Supplier discovery alone does not count as a hire."
      />
      <div className="mt-7 overflow-hidden rounded-lg border border-[var(--ws-border)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_110px] gap-4 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-4 py-3 text-[13px] text-[#777780] md:grid">
          <span>Provider and project</span>
          <span>Status</span>
          <span>Committed</span>
          <span className="text-right">Updated</span>
        </div>
        {jobs.length ? (
          jobs.map((job) => (
            <Link
              key={job.id}
              href={`/app/projects/${job.project.id}`}
              className="grid gap-2 border-b border-[var(--ws-border)] px-4 py-3.5 transition-colors last:border-0 hover:bg-[#171719] md:grid-cols-[minmax(0,1fr)_130px_130px_110px] md:items-center md:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#e8e8eb]">
                  {job.provider} · {job.externalServiceId}
                </p>
                <p className="mt-1 truncate text-[13px] text-[#777780]">
                  {job.project.request.rawBrief}
                </p>
              </div>
              <StateDot state={job.state} />
              <span className="text-[14px] text-[#a1a1aa]">
                {formatMoney(job.committedMinor, job.currency)}
              </span>
              <span className="text-[14px] text-[#777780] md:text-right">
                {job.updatedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        ) : (
          <WorkspaceEmpty
            title="No agents hired"
            description="Auvra has not placed a supplier job for your projects. Marketplace matches in a quote are observations, not hires."
            href="/app/projects"
            action="View projects"
          />
        )}
      </div>
    </main>
  );
}
