import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, CircleDollarSign, Clock3, FileQuestion, FileText, FolderKanban, Plus, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/authz";
import { getCustomerOverview } from "@/lib/customer-overview";

export default async function CustomerHome() {
  const user = await requirePageUser();
  const { requests, projects, requestCount, projectCount, quoteReadyCount, notifications } = await getCustomerOverview(user.id);
  const firstName = user.name?.split(/\s+/)[0] ?? "there";
  const actionRequired = requests.filter((request) => ["NEEDS_CLARIFICATION", "QUOTED", "APPROVED"].includes(request.state));

  return (
    <main className="mx-auto max-w-[1450px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><Badge variant="neutral"><span className="size-1.5 rounded-full bg-amber-300" />Demo sandbox · no live spend</Badge><h1 className="mt-5 text-4xl font-medium tracking-[-.055em] sm:text-5xl">Welcome, {firstName}.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Manage requests from brief to plan, supplier coverage, quote, funding, and delivery. Every paid action remains approval-gated.</p></div>
        <Button asChild variant="violet"><Link href="/app/requests/new"><Plus className="size-4" />New request</Link></Button>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={FileText} label="Requests" value={String(requestCount)} detail="Submitted service outcomes" />
        <SummaryCard icon={FileQuestion} label="Action required" value={String(actionRequired.length)} detail="Clarifications, quotes, or funding" accent={actionRequired.length > 0} />
        <SummaryCard icon={CircleDollarSign} label="Quotes ready" value={String(quoteReadyCount)} detail="Awaiting your decision" accent={quoteReadyCount > 0} />
        <SummaryCard icon={FolderKanban} label="Projects" value={String(projectCount)} detail="Demo funded plans" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {actionRequired.length > 0 && <Card className="overflow-hidden border-violet-400/15"><div className="flex items-center justify-between border-b border-white/[.08] px-6 py-5"><div><p className="text-sm font-medium">Needs your attention</p><p className="mt-1 text-xs text-zinc-600">Complete these steps to keep work moving</p></div><Badge>{actionRequired.length} open</Badge></div><div className="divide-y divide-white/[.07]">{actionRequired.map((request) => <RequestRow key={request.id} request={request} action />)}</div></Card>}

          <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/[.08] px-6 py-5"><div><p className="text-sm font-medium">Recent requests</p><p className="mt-1 text-xs text-zinc-600">Real database-backed workflow state</p></div>{requests.length > 0 && <Button asChild size="sm" variant="ghost"><Link href="/app/requests/new"><Plus className="size-3.5" />New</Link></Button>}</div>{requests.length === 0 ? <EmptyWorkspace /> : <div className="divide-y divide-white/[.07]">{requests.map((request) => <RequestRow key={request.id} request={request} />)}</div>}</Card>

          {projects.length > 0 && <Card className="overflow-hidden"><div className="border-b border-white/[.08] px-6 py-5"><p className="text-sm font-medium">Projects</p><p className="mt-1 text-xs text-zinc-600">Funded plans and their current status</p></div><div className="divide-y divide-white/[.07]">{projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-white/[.025]"><div><p className="line-clamp-1 text-sm text-zinc-200">{project.request.rawBrief}</p><p className="mt-1 text-xs text-zinc-600">Created {project.createdAt.toLocaleDateString()}</p></div><Badge variant="warning">{project.state}</Badge></Link>)}</div></Card>}

          <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><Sparkles className="size-5 text-violet-300" /><div><p className="text-sm font-medium">How Auvra moves work</p><p className="mt-1 text-xs text-zinc-600">Current workflow and future guarded steps</p></div></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{label:"Brief",copy:"Request and constraints saved",ready:true},{label:"Plan",copy:"Clarifications and scoped tasks",ready:true},{label:"Quote",copy:"Live supplier coverage and price",ready:true},{label:"Execute",copy:"Test funding, hiring, QA, delivery",ready:false}].map((step,index)=><div key={step.label} className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-zinc-600">0{index+1}</span>{step.ready ? <CheckCircle2 className="size-4 text-emerald-300" /> : <Clock3 className="size-4 text-zinc-700" />}</div><p className="mt-5 text-sm font-medium">{step.label}</p><p className="mt-2 text-xs leading-5 text-zinc-600">{step.copy}</p></div>)}</div></Card>
        </div>

        <aside className="space-y-6">
          <Card className="overflow-hidden"><div className="flex items-center gap-3 border-b border-white/[.08] px-6 py-5"><Bell className="size-4 text-violet-300" /><div><p className="text-sm font-medium">Recent activity</p><p className="mt-1 text-xs text-zinc-600">Manager and quote events</p></div></div>{notifications.length === 0 ? <div className="p-6 text-xs leading-5 text-zinc-600">Activity appears here when Auvra analyzes, scopes, matches, and quotes your requests.</div> : <div className="divide-y divide-white/[.07]">{notifications.map((notification)=><div key={notification.id} className="p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-zinc-300">{notification.title}</p>{!notification.readAt && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-violet-400" />}</div><p className="mt-2 text-[11px] leading-5 text-zinc-600">{notification.body}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[.1em] text-zinc-700">{notification.createdAt.toLocaleString()}</p></div>)}</div>}</Card>
          <Card className="p-6"><ShieldCheck className="size-5 text-emerald-300" /><p className="mt-5 text-sm font-medium">Financial guardrails</p><ul className="mt-4 space-y-3 text-xs text-zinc-500">{["No supplier hire before funding","No payment inferred from redirects","Every quote is versioned","Marketplace writes remain disabled"].map(item=><li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></Card>
        </aside>
      </section>
    </main>
  );
}

type RequestRowProps = {
  id: string;
  rawBrief: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  quotes: Array<{ state: string; customerTotalMinor: bigint; currency: string }>;
};

function RequestRow({ request, action = false }: { request: RequestRowProps; action?: boolean }) {
  const quote = request.quotes[0];
  return <Link href={`/app/requests/${request.id}`} className="group flex flex-col justify-between gap-4 px-6 py-5 transition hover:bg-white/[.025] sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="line-clamp-1 text-sm text-zinc-200">{request.rawBrief}</p>{action && <span className="size-1.5 shrink-0 rounded-full bg-violet-400" />}</div><p className="mt-1 text-xs text-zinc-600">{nextStep(request.state)} · Updated {request.updatedAt.toLocaleDateString()}</p></div><div className="flex shrink-0 items-center gap-3">{quote && <span className="text-xs font-medium text-emerald-200">{formatMinor(quote.customerTotalMinor, quote.currency)}</span>}<Badge variant={request.state === "QUOTED" ? "success" : request.state === "NEEDS_CLARIFICATION" ? "warning" : "neutral"}>{request.state.replaceAll("_", " ")}</Badge><ArrowRight className="size-4 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" /></div></Link>;
}

function EmptyWorkspace() {
  return <div className="grid min-h-[330px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><FolderKanban className="size-5" /></span><h2 className="mt-5 text-xl tracking-[-.03em]">Start with an outcome.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">Describe what you need. Auvra will clarify it, build a plan, check real supplier coverage, and quote before asking for funding.</p><Button asChild className="mt-6" variant="violet"><Link href="/app/requests/new">Describe your first outcome <ArrowRight className="size-4" /></Link></Button></div></div>;
}

function SummaryCard({ icon: Icon, label, value, detail, accent = false }: { icon: typeof FileText; label: string; value: string; detail: string; accent?: boolean }) {
  return <Card className={`p-6 ${accent ? "border-violet-400/20 bg-violet-400/[.035]" : ""}`}><Icon className={`size-5 ${accent ? "text-violet-300" : "text-zinc-500"}`} /><p className="mt-6 font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">{label}</p><p className="mt-3 text-3xl font-medium tracking-[-.05em]">{value}</p><p className="mt-2 text-xs text-zinc-600">{detail}</p></Card>;
}

function nextStep(state: string) {
  const labels: Record<string,string> = { SUBMITTED:"Manager analysis starts on open", ANALYZING:"Manager is building the scope", NEEDS_CLARIFICATION:"Answer clarification questions", SCOPED:"Check live supplier coverage", QUOTED:"Review and decide on the quote", APPROVED:"Demo funding is the next step", PROJECT_CREATED:"Open the project plan", UNSUPPORTED:"Request stopped before procurement" };
  return labels[state] ?? "Open request details";
}

function formatMinor(minor: bigint, currency: string) {
  const value = minor.toString().padStart(3, "0");
  return `${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}
