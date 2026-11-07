import Link from "next/link";
import { ArrowRight, Check, Circle, LockKeyhole } from "lucide-react";

import { StateDot, WorkspaceEmpty, WorkspaceHeader } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requirePageUser();
  const { project: selectedId } = await searchParams;
  const projects = await prisma.project.findMany({
    where: { customerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      state: true,
      request: { select: { rawBrief: true } },
      tasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          taskKey: true,
          title: true,
          objective: true,
          status: true,
          dependenciesJson: true,
          supplierJobs: { select: { id: true, provider: true, state: true } },
        },
      },
      supplierJobs: { select: { id: true, state: true } },
    },
  });
  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Operations"
        description="The recorded workflow behind each project. Execution controls appear when procurement is enabled."
      />
      {selected ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav
            aria-label="Select a project"
            className="h-fit overflow-hidden rounded-lg border border-[var(--ws-border)]"
          >
            <p className="border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-4 py-3 text-[13px] font-medium text-[#85858e]">
              Projects
            </p>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/operations?project=${project.id}`}
                aria-current={selected.id === project.id ? "page" : undefined}
                className={`block border-b border-[var(--ws-border)] px-4 py-3 text-[14px] last:border-0 ${selected.id === project.id ? "bg-[#1c1b20] text-white" : "text-[#a1a1aa] hover:bg-[#171719]"}`}
              >
                <span className="block truncate">{project.request.rawBrief}</span>
                <span className="mt-1 block text-[12px] text-[#777780]">
                  {project.state.replaceAll("_", " ")}
                </span>
              </Link>
            ))}
          </nav>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{selected.request.rawBrief}</h2>
                <div className="mt-2">
                  <StateDot state={selected.state} />
                </div>
              </div>
              <Link
                href={`/app/projects/${selected.id}`}
                className="inline-flex items-center gap-1 text-[14px] text-[#a78bfa] hover:text-white"
              >
                Project details
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="mt-6 overflow-hidden rounded-lg border border-[var(--ws-border)]">
              <div className="border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-5 py-3 text-[14px] font-medium text-[#d4d4d8]">
                Task sequence
              </div>
              {selected.tasks.length ? (
                selected.tasks.map((task, index) => {
                  const dependencies = Array.isArray(task.dependenciesJson)
                    ? task.dependenciesJson.filter(
                        (item): item is string => typeof item === "string",
                      )
                    : [];
                  return (
                    <div
                      key={task.id}
                      className="flex gap-4 border-b border-[var(--ws-border)] px-5 py-5 last:border-0"
                    >
                      <div className="flex flex-col items-center">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#38383d] bg-[#1a1a1c] text-[13px] text-[#b8a1fa]">
                          {task.status === "DONE" ? (
                            <Check className="size-3.5" />
                          ) : (
                            String(index + 1)
                          )}
                        </span>
                        {index < selected.tasks.length - 1 && (
                          <span className="mt-2 h-full w-px bg-[#303035]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-[14px] font-medium text-[#ececef]">{task.title}</h3>
                          <StateDot state={task.status} />
                        </div>
                        <p className="mt-1 text-[14px] leading-5 text-[#92929b]">
                          {task.objective}
                        </p>
                        <p className="mt-3 text-[13px] text-[#777780]">
                          {dependencies.length
                            ? `Depends on ${dependencies.join(", ")}`
                            : "No dependencies"}{" "}
                          ·{" "}
                          {task.supplierJobs.length
                            ? `${task.supplierJobs.length} agent job(s)`
                            : "No agent hired"}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <WorkspaceEmpty
                  title="No tasks recorded"
                  description="The project has no planned tasks yet."
                />
              )}
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4 text-[14px] leading-5 text-[#a1a1aa]">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
              Supplier procurement and execution remain paused. This view reflects saved task and
              job state; it does not start work.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-[var(--ws-border)]">
          <WorkspaceEmpty
            title="No operational runs"
            description="When a request becomes a project, its planned tasks and agent jobs will appear here."
            href="/app/requests"
            action="View requests"
          />
        </div>
      )}
    </main>
  );
}
