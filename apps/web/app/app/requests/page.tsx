import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { StateDot, WorkspaceEmpty, WorkspaceHeader } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const filters = [
  "all",
  "submitted",
  "analyzing",
  "needs_clarification",
  "scoped",
  "quoted",
  "approved",
  "awaiting_funds",
  "funded",
  "project_created",
  "unsupported",
  "rejected",
  "cancelled",
  "expired",
] as const;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const status = filters.includes(params.status as (typeof filters)[number])
    ? params.status!
    : "all";
  const requests = await prisma.serviceRequest.findMany({
    where: {
      customerId: user.id,
      ...(q ? { rawBrief: { contains: q, mode: "insensitive" as const } } : {}),
      ...(status !== "all" ? { state: status.toUpperCase() as "SUBMITTED" } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      rawBrief: true,
      state: true,
      updatedAt: true,
      createdAt: true,
      quotes: {
        orderBy: { version: "desc" },
        take: 1,
        select: { customerTotalMinor: true, currency: true },
      },
    },
  });
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Requests"
        description="Every outcome starts with a brief. Review scopes and decide what moves forward."
        action={
          <Link
            href="/app/requests/new"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3.5 text-[14px] font-semibold text-white hover:bg-violet-500"
          >
            <Plus className="size-3.5" />
            New request
          </Link>
        }
      />
      <form
        className="mt-7 flex flex-col gap-3 sm:flex-row"
        action="/app/requests"
      >
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3">
          <Search className="size-3.5 text-[#777780]" />
          <span className="sr-only">Search requests</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search briefs"
            className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-[#777780]"
          />
        </label>
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-9 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 text-[14px] text-[#d4d4d8]"
        >
          <option value="all">All statuses</option>
          {filters.slice(1).map((filter) => (
            <option
              key={filter}
              value={filter}
            >
              {filter.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg border border-[#39393d] px-4 text-[14px] text-[#e4e4e7] hover:bg-[#1a1a1c]"
        >
          Apply
        </button>
      </form>
      <div className="mt-5 overflow-hidden rounded-lg border border-[var(--ws-border)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_150px_110px] gap-4 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-4 py-3 text-[13px] text-[#777780] sm:grid">
          <span>Brief</span>
          <span>Status</span>
          <span className="text-right">Updated</span>
        </div>
        {requests.length ? (
          requests.map((request) => (
            <Link
              key={request.id}
              href={`/app/requests/${request.id}`}
              className="grid gap-2 border-b border-[var(--ws-border)] px-4 py-3.5 transition-colors last:border-0 hover:bg-[#171719] sm:grid-cols-[minmax(0,1fr)_150px_110px] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#e8e8eb]">
                  {request.rawBrief}
                </p>
                <p className="mt-1 text-[13px] text-[#777780]">
                  {request.id.slice(0, 8).toUpperCase()} · Created{" "}
                  {request.createdAt.toLocaleDateString()}
                </p>
              </div>
              <StateDot state={request.state} />
              <span className="text-[14px] text-[#777780] sm:text-right">
                {request.updatedAt.toLocaleDateString()}
              </span>
            </Link>
          ))
        ) : (
          <WorkspaceEmpty
            title={q || status !== "all" ? "No matching requests" : "No requests yet"}
            description={
              q || status !== "all"
                ? "Try a different search or status."
                : "Describe what you need done to begin a new service request."
            }
            href={q || status !== "all" ? "/app/requests" : "/app/requests/new"}
            action={q || status !== "all" ? "Clear filters" : "Create a request"}
          />
        )}
      </div>
      <p className="mt-3 text-[13px] text-[#777780]">
        Showing up to 100 requests from your account.
      </p>
    </main>
  );
}
