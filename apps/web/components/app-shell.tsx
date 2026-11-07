import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { AppSidebarNav, MobileWorkspaceNav } from "@/components/app-sidebar";
import { Brand } from "@/components/brand";

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  const initials =
    userName
      ?.split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AU";
  return (
    <div className="workspace min-h-screen bg-[var(--ws-bg)] text-[var(--ws-text)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[var(--ws-border)] bg-[var(--ws-sidebar)] lg:flex">
        <div className="flex h-15 items-center border-b border-[var(--ws-border)] px-5">
          <Brand />
        </div>
        <div className="px-3 pb-5 pt-6">
          <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-[.13em] text-[#696971]">
            Workspace
          </p>
          <AppSidebarNav />
        </div>
        <div className="mt-auto border-t border-[var(--ws-border)] px-3 py-3">
          <div className="mb-3 flex items-center gap-2 px-3 text-[13px] text-[#85858e]">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Development sandbox
          </div>
          <Link
            href="/app/settings"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[#1c1c1e]"
          >
            <span className="grid size-8 place-items-center rounded-md border border-[#343438] bg-[#222225] text-[13px] font-semibold">
              {initials}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-[#d8d8db]">
              {userName || "Account"}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 text-[#777780]"
            />
          </Link>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-[232px]">
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between border-b border-[var(--ws-border)] bg-[var(--ws-bg)] px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileWorkspaceNav />
            <Brand />
          </div>
          <span className="hidden text-[14px] text-[#74747c] lg:inline">
            Auvra <span className="mx-2 text-[#45454b]">/</span> Workspace
          </span>
          <Link
            href="/app/settings"
            aria-label="Account settings"
            className="grid size-8 place-items-center rounded-full border border-[#343438] bg-[#1b1b1d] text-[13px] font-semibold text-[#e7e7e9] lg:hidden"
          >
            {initials}
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
