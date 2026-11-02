import Link from "next/link";
import { Bell, Settings, ShieldCheck } from "lucide-react";

import { AppSidebarNav } from "@/components/app-sidebar";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppShell({ children, userName }: { children: React.ReactNode; userName?: string | null }) {
  const initials = userName?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AU";

  return (
    <div className="min-h-screen bg-[#09090a] text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/[.08] bg-[#111113] lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-white/[.08] px-5"><Brand /></div>
        <div className="px-4 py-5"><Badge variant="neutral" className="w-full justify-center"><span className="size-1.5 rounded-full bg-amber-300" /> Demo sandbox</Badge></div>
        <AppSidebarNav />
        <div className="mt-auto space-y-1 border-t border-white/[.08] p-3"><Link href="/app" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:text-white"><ShieldCheck className="size-4" />Operating controls</Link><Link href="/app" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:text-white"><Settings className="size-4" />Settings</Link></div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[.08] bg-[#09090a]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10"><div className="lg:hidden"><Brand compact /></div><div className="hidden font-mono text-[10px] uppercase tracking-[.15em] text-zinc-600 lg:block">Customer workspace · demo sandbox</div><div className="flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="size-4" /></Button><div className="grid size-9 place-items-center rounded-full bg-violet-600 text-xs font-semibold" aria-label={userName ? `${userName} account` : "Customer account"}>{initials}</div></div></header>
        {children}
      </div>
    </div>
  );
}
