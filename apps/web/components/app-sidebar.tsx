"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  FolderKanban,
  LayoutGrid,
  ListTodo,
  Menu,
  ReceiptText,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/brand";

export const workspaceNav = [
  { href: "/app", label: "Overview", icon: LayoutGrid },
  { href: "/app/requests", label: "Requests", icon: ListTodo },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/operations", label: "Operations", icon: SlidersHorizontal },
  { href: "/app/treasury", label: "Treasury", icon: ReceiptText },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppSidebarNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Workspace"
      className={mobile ? "flex min-w-max gap-1 px-4" : "space-y-0.5 px-3"}
    >
      {workspaceNav.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/app"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${mobile ? "whitespace-nowrap" : ""} ${active ? "bg-[#1c1c1e] text-[#fafafa]" : "text-[#9898a2] hover:bg-[#171719] hover:text-[#fafafa]"}`}
          >
            {!mobile && active && (
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--brand)]" />
            )}
            <Icon
              aria-hidden="true"
              className={`size-4 shrink-0 ${active ? "text-[var(--brand-light)]" : "text-[#777780] group-hover:text-[#a1a1aa]"}`}
              strokeWidth={1.8}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileWorkspaceNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close workspace navigation" : "Open workspace navigation"}
        aria-expanded={open}
        aria-controls="mobile-workspace-nav"
        onClick={() => setOpen(!open)}
        className="grid size-9 place-items-center rounded-lg border border-[#343438] text-[#e7e7e9] transition-colors hover:bg-[#1b1b1e] lg:hidden"
      >
        {open ? (
          <X
            aria-hidden="true"
            className="size-4"
          />
        ) : (
          <Menu
            aria-hidden="true"
            className="size-4"
          />
        )}
      </button>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
        />
      )}
      <div
        id="mobile-workspace-nav"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-40 w-[min(82vw,304px)] border-r border-[var(--ws-border)] bg-[var(--ws-sidebar)] px-3 pb-6 pt-20 shadow-2xl transition-[transform,visibility] duration-200 lg:hidden ${open ? "visible translate-x-0" : "pointer-events-none invisible -translate-x-full"}`}
      >
        <div className="absolute inset-x-3 top-0 flex h-15 items-center justify-between border-b border-[var(--ws-border)] px-2">
          <Brand />
          <button
            type="button"
            aria-label="Close workspace navigation"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-lg text-[#a1a1aa] hover:bg-[#1b1b1e] hover:text-white"
          >
            <X
              aria-hidden="true"
              className="size-4"
            />
          </button>
        </div>
        <p className="px-3 pb-3 text-[12px] font-semibold uppercase tracking-[.13em] text-[#696971]">
          Workspace
        </p>
        <AppSidebarNav />
        <div className="mx-3 mt-8 border-t border-[var(--ws-border)] pt-5 text-[13px] text-[#85858e]">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-amber-400" />
          Development sandbox
        </div>
      </div>
    </>
  );
}
