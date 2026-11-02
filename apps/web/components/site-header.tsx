import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f6f4ef]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1520px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-9">
          <Brand tone="dark" />
          <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-[.08em] text-zinc-500 md:flex">
            <Link className="transition hover:text-black" href="#capabilities">What Auvra does</Link>
            <Link className="transition hover:text-black" href="#process">How it works</Link>
            <Link className="transition hover:text-black" href="#proof">Proof</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden text-zinc-600 hover:bg-black/5 hover:text-black sm:inline-flex"><Link href="/app">Sign in</Link></Button>
          <Button asChild size="sm" className="bg-zinc-950 text-white hover:bg-violet-700"><Link href="/app/requests/new">Request a service <ArrowUpRight className="size-3.5" /></Link></Button>
        </div>
      </div>
    </header>
  );
}
