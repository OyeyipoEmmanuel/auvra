import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CalendarDays, ChevronDown, CircleDollarSign, Clock3, FileText, Info, ListChecks, ReceiptText, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ManagerPanel } from "@/components/manager-panel";
import { QuoteActions } from "@/components/quote-actions";
import { SupplierDiscoveryPanel } from "@/components/supplier-discovery-panel";
import { SandboxFundingPanel } from "@/components/sandbox-funding-panel";
import { requirePageUser } from "@/lib/authz";
import { isManagerAnalysis } from "@/lib/manager-analysis";
import { prisma } from "@/lib/prisma";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const request = await prisma.serviceRequest.findFirst({
    where: { id, customerId: user.id },
    select: {
      id: true,
      state: true,
      rawBrief: true,
      desiredOutcome: true,
      budgetMinor: true,
      budgetCurrency: true,
      deadline: true,
      constraintsJson: true,
      analysisJson: true,
      submittedAt: true,
      createdAt: true,
      quotes: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true, state: true, currency: true, customerTotalMinor: true, executionCostMinor: true, reserveMinor: true, feeMinor: true, assumptionsJson: true, exclusionsJson: true, expiresAt: true, acceptedAt: true },
      },
      project: { select: { id: true } },
    },
  });

  if (!request) notFound();

  const constraints = Array.isArray(request.constraintsJson)
    ? request.constraintsJson.filter((item): item is string => typeof item === "string")
    : [];
  const analysis = isManagerAnalysis(request.analysisJson) ? request.analysisJson : null;
  const quote = request.quotes[0];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/app" className="inline-flex items-center gap-2 text-xs text-zinc-500 transition hover:text-white"><ArrowLeft className="size-3.5" />Back to workspace</Link>

      <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3"><Badge variant="success">Request created</Badge><Badge variant="neutral">{formatState(request.state)}</Badge></div>
          <h1 className="mt-5 text-4xl font-medium tracking-[-.055em] sm:text-5xl">Your request is in.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">{statusDescription(request.state)}</p>
        </div>
        <Button asChild variant="outline"><Link href="/app/requests/new">Create another request</Link></Button>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Summary icon={Clock3} label="Status" value={formatState(request.state)} />
        <Summary icon={CircleDollarSign} label="Budget" value={request.budgetMinor && request.budgetCurrency ? formatBudget(request.budgetMinor, request.budgetCurrency) : "Not specified"} />
        <Summary icon={CalendarDays} label="Deadline" value={request.deadline ? request.deadline.toLocaleDateString() : "Not specified"} />
      </section>

      <ManagerPanel requestId={request.id} state={request.state} analysis={analysis} />
      {analysis?.plan && <SupplierDiscoveryPanel requestId={request.id} state={request.state} discovery={analysis.discovery} />}
      {quote && <QuoteCard quote={quote} />}
      {quote?.state === "ACCEPTED" && process.env.AUVRA_RUNTIME_MODE === "DEMO_SANDBOX" && <SandboxFundingPanel quoteId={quote.id} amount={formatBudget(quote.customerTotalMinor, quote.currency)} projectId={request.project?.id} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">Original brief</p>
            <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-zinc-200">{request.rawBrief}</p>
          </Card>

          {request.desiredOutcome && <Card className="p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">Desired outcome</p><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{request.desiredOutcome}</p></Card>}

          {constraints.length > 0 && <Card className="p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">Constraints and context</p><ul className="mt-5 space-y-3">{constraints.map((constraint, index) => <li key={`${constraint}-${index}`} className="flex gap-3 text-sm leading-6 text-zinc-400"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-400" />{constraint}</li>)}</ul></Card>}
        </div>

        <aside className="space-y-4">
          <Card className="p-6"><FileText className="size-5 text-violet-300" /><p className="mt-5 text-sm font-medium">Request record</p><dl className="mt-5 space-y-4 text-xs"><Meta label="Reference" value={request.id.slice(0, 8).toUpperCase()} /><Meta label="Created" value={request.createdAt.toLocaleString()} /><Meta label="Submitted" value={request.submittedAt?.toLocaleString() ?? "Pending"} /></dl></Card>
          <Card className="border-emerald-400/10 bg-emerald-400/[.025] p-6"><ShieldCheck className="size-5 text-emerald-300" /><p className="mt-4 text-sm font-medium text-emerald-100">{request.project ? "Demo project active" : "Supplier spending off"}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{request.project ? "Only simulated funds were recorded. Supplier hiring remains disabled." : "Auvra will not hire agents until a separate verified funding and procurement workflow is enabled."}</p></Card>
        </aside>
      </div>
    </main>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <Card className="p-5"><Icon className="size-4 text-violet-300" /><p className="mt-5 font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">{label}</p><p className="mt-2 text-sm font-medium text-zinc-200">{value}</p></Card>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-zinc-600">{label}</dt><dd className="mt-1 break-all text-zinc-300">{value}</dd></div>;
}

function formatState(state: string) {
  return state.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatBudget(minor: bigint, currency: string) {
  const value = minor.toString().padStart(3, "0");
  return `${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}

function statusDescription(state: string) {
  if (state === "SUBMITTED" || state === "ANALYZING") return "Auvra has securely recorded the original brief and is beginning Manager analysis. Nothing has been purchased or spent.";
  if (state === "NEEDS_CLARIFICATION") return "Manager analysis found a few missing details. Answer the questions below so Auvra can complete the scope.";
  if (state === "SCOPED") return "The initial task plan is ready. Supplier availability and pricing have not been checked, and nothing has been purchased or spent.";
  if (state === "QUOTED") return "A live-catalog supplier match and versioned quote are ready for review. Nothing has been funded, hired, or spent.";
  if (state === "APPROVED") return "You approved the scope and quote. Funding remains a separate required step, and no supplier has been hired.";
  if (state === "PROJECT_CREATED") return "The sandbox project and its tasks are ready. No real tokens moved or supplier jobs started.";
  if (state === "UNSUPPORTED") return "Manager analysis stopped this request before supplier discovery or payment.";
  return "Auvra has securely recorded the request. Nothing is purchased without an approved quote and verified funding.";
}

type QuoteView = {
  id: string;
  version: number;
  state: string;
  currency: string;
  customerTotalMinor: bigint;
  executionCostMinor: bigint;
  reserveMinor: bigint;
  feeMinor: bigint;
  assumptionsJson: unknown;
  exclusionsJson: unknown;
  expiresAt: Date;
  acceptedAt: Date | null;
};

function QuoteCard({ quote }: { quote: QuoteView }) {
  const assumptions = stringArray(quote.assumptionsJson);
  const exclusions = stringArray(quote.exclusionsJson);
  const presented = quote.state === "PRESENTED";
  return (
    <Card className="mt-6 overflow-hidden border-violet-400/20 bg-[#111115]">
      <div className="relative overflow-hidden border-b border-white/[.08] px-5 py-7 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={quote.state === "ACCEPTED" ? "success" : "default"}>Quote {quote.state.toLowerCase()}</Badge>
            <Badge variant="neutral">Version {quote.version}</Badge>
          </div>
          <h2 className="mt-5 text-[1.7rem] font-medium leading-tight tracking-[-.045em] text-white sm:text-3xl">Your project quote</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">A clear price for the proposed scope, with the costs and conditions in one place.</p>
          <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-xl border border-violet-400/15 bg-violet-400/[.06] px-4 py-3">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-300" />
            <p className="text-xs leading-5 text-zinc-300">Supplier prices and availability are observed, not reserved. Funding and hiring happen in a later step.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <aside className="relative overflow-hidden rounded-[1.5rem] border border-violet-300/20 bg-[linear-gradient(145deg,rgba(108,65,190,.22),rgba(24,20,34,.94)_55%,rgba(15,15,19,1))] p-5 shadow-[0_22px_60px_rgba(0,0,0,.2)] sm:p-6 lg:order-2">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-violet-400/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/10"><ReceiptText aria-hidden="true" className="size-5 text-violet-200" /></span>
              <span className="rounded-full border border-white/10 bg-white/[.05] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-zinc-300">{quote.currency}</span>
            </div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[.16em] text-violet-200/80">Total project price</p>
            <p className="mt-2 break-words text-4xl font-medium tracking-[-.055em] text-white sm:text-[2.65rem]">{formatBudget(quote.customerTotalMinor, quote.currency)}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">Complete quoted price for this version of the scope.</p>
            <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-xs">
              <PriceLine label="Observed supplier cost" value={formatBudget(quote.executionCostMinor, quote.currency)} />
              <PriceLine label="Execution reserve" value={formatBudget(quote.reserveMinor, quote.currency)} />
              <PriceLine label="Auvra service fee" value={formatBudget(quote.feeMinor, quote.currency)} />
            </dl>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-zinc-400">{quote.state === "ACCEPTED" && quote.acceptedAt ? `Accepted ${quote.acceptedAt.toLocaleString()}. Demo funding is available below.` : `Quote expires ${quote.expiresAt.toLocaleString()}.`}</p>
          </div>
        </aside>

        <div className="space-y-4 lg:order-1">
          <div>
            <h3 className="text-base font-medium text-zinc-100">Scope details</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Review what this quote assumes and what it leaves out before approving.</p>
          </div>
          <QuoteList kind="assumptions" items={assumptions} />
          <QuoteList kind="exclusions" items={exclusions} />
        </div>
      </div>

      {presented && <QuoteActions quoteId={quote.id} />}
    </Card>
  );
}

function QuoteList({ kind, items }: { kind: "assumptions" | "exclusions"; items: string[] }) {
  const isAssumptions = kind === "assumptions";
  return (
    <details className="group overflow-hidden rounded-2xl border border-white/[.09] bg-white/[.025] open:border-violet-400/20">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-400 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
          {isAssumptions ? <ListChecks aria-hidden="true" className="size-4" /> : <Ban aria-hidden="true" className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-100">{isAssumptions ? "Assumptions" : "Exclusions"}</span>
          <span className="mt-0.5 block text-xs text-zinc-500">{isAssumptions ? "What the price is based on" : "What is outside this scope"}</span>
        </span>
        <span className="rounded-full bg-white/[.06] px-2 py-0.5 font-mono text-[10px] text-zinc-400">{items.length}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ol className="space-y-3 border-t border-white/[.07] px-4 py-4 sm:px-5">
        {items.length === 0 && <li className="text-xs text-zinc-500">None listed for this quote.</li>}
        {items.map((item, index) => <li key={`${kind}-${index}`} className="flex items-start gap-3 text-[13px] leading-6 text-zinc-300"><span className="min-w-5 shrink-0 font-mono text-[10px] text-violet-300/80">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>)}
      </ol>
    </details>
  );
}

function PriceLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><dt className="text-zinc-400">{label}</dt><dd className="shrink-0 font-medium tabular-nums text-zinc-100">{value}</dd></div>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
