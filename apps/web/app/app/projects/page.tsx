import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { StateDot, WorkspaceEmpty, WorkspaceHeader } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage() {
  const user = await requirePageUser();
  const projects = await prisma.project.findMany({
    where: { customerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      state: true,
      updatedAt: true,
      request: { select: { rawBrief: true } },
      tasks: { select: { id: true, status: true } },
      supplierJobs: { select: { id: true } },
    },
  });
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Projects"
        description="Funded work, task progress, and delivery status."
      />
      <div className="mt-7 overflow-hidden rounded-lg border border-[var(--ws-border)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_130px_90px_100px_100px] gap-3 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-4 py-3 text-[13px] text-[#777780] md:grid">
          <span>Project</span>
          <span>Status</span>
          <span>Tasks</span>
          <span>Agents</span>
          <span className="text-right">Updated</span>
        </div>
        {projects.length ? (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className="grid gap-2 border-b border-[var(--ws-border)] px-4 py-3.5 transition-colors last:border-0 hover:bg-[#171719] md:grid-cols-[minmax(0,1fr)_130px_90px_100px_100px] md:items-center md:gap-3"
            >
              <span className="min-w-0 truncate text-[14px] font-medium text-[#e8e8eb]">
                {project.request.rawBrief}
              </span>
              <StateDot state={project.state} />
              <span className="text-[14px] text-[#85858e]">
                {project.tasks.filter((task) => task.status === "DONE").length}/
                {project.tasks.length} done
              </span>
              <span className="text-[14px] text-[#85858e]">
                {project.supplierJobs.length || "None"}
              </span>
              <span className="text-[14px] text-[#777780] md:text-right">
                {project.updatedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        ) : (
          <WorkspaceEmpty
            title="No projects yet"
            description="A project appears after you accept a quote and complete its funding step. Demo funding is clearly marked."
            href="/app/requests"
            action="View requests"
          />
        )}
      </div>
      {projects.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-[14px] text-[#85858e]">
          <FolderKanban className="size-3.5" />
          Supplier execution is currently paused; task counts reflect recorded state only.
        </p>
      )}
    </main>
  );
}
