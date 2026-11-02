"use client";

import Link from "next/link";
import { CircleDollarSign, FileText, LayoutDashboard, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/requests/new", label: "New request", icon: Plus },
  { href: "/app#requests", label: "Requests", icon: FileText },
  { href: "/app#billing", label: "Billing", icon: CircleDollarSign },
];

export function AppSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-3">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = label === "Overview" ? pathname === "/app" : label === "New request" && pathname.startsWith("/app/requests/new");

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active ? "bg-white/[.07] text-white" : "text-zinc-500 hover:bg-white/[.04] hover:text-white"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
