"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleDollarSign, LoaderCircle, LockKeyhole, Search, Sparkles, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const examples = [
  "Build a landing page for my business.",
  "Research my competitors.",
  "Create a marketing strategy.",
  "Design a logo.",
  "Analyze this dataset.",
];

const managerSteps = [
  { icon: Workflow, title: "Break down the outcome", copy: "Turn the request into clear tasks, deliverables, and acceptance checks." },
  { icon: Search, title: "Find the right specialists", copy: "Search NEAR Agent Market and verify capability, availability, and price." },
  { icon: CircleDollarSign, title: "Build a transparent quote", copy: "Combine supplier cost, operating reserve, timeline, and Auvra margin." },
];

type ApiError = { error?: { message?: string } };
type CreateRequestResponse = { request?: { id: string } } & ApiError;

export function RequestIntake() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const budget = String(form.get("budget") ?? "").trim();
    const currency = String(form.get("currency") ?? "USD").trim().toUpperCase();
    const deadline = String(form.get("deadline") ?? "").trim();
    const desiredOutcome = String(form.get("desiredOutcome") ?? "").trim();
    const constraints = String(form.get("constraints") ?? "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const budgetMinor = budget ? toMinorUnits(budget) : undefined;
    if (budget && !budgetMinor) {
      setError("Enter a valid budget with no more than two decimal places.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          rawBrief: brief.trim(),
          ...(desiredOutcome ? { desiredOutcome } : {}),
          ...(budgetMinor ? { budgetMinor, budgetCurrency: currency } : {}),
          ...(deadline ? { preferredDeadline: new Date(`${deadline}T23:59:59.999Z`).toISOString() } : {}),
          constraints,
          attachmentIds: [],
          consentToExternalAgentProcessing: true,
        }),
      });

      const data = await response.json() as CreateRequestResponse;
      if (!response.ok || !data.request?.id) {
        throw new Error(data.error?.message ?? "Auvra could not create this request. Please try again.");
      }

      router.push(`/app/requests/${data.request.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Auvra could not create this request. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/app" className="inline-flex items-center gap-2 text-xs text-zinc-500 transition hover:text-white"><ArrowLeft className="size-3.5" />Back to workspace</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <Badge>New request · Manager intake</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl tracking-[-.055em] sm:text-6xl">What should Auvra get done?</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">Describe the outcome in your own words. Auvra will securely save it, assess feasibility, design the work plan, and prepare a quote before anything is purchased.</p>

          <Card className="mt-9 p-6 sm:p-8">
            <form className="space-y-7" onSubmit={submitRequest}>
              <Field label="Describe the service you need" hint="Plain language is perfect">
                <Textarea name="request" required minLength={12} maxLength={8000} value={brief} onChange={(event) => setBrief(event.target.value)} className="min-h-44 resize-y text-base leading-7" placeholder="Example: Build a modern landing page for my accounting business. It should explain our services, collect consultation requests, and be ready to publish." />
              </Field>

              <div>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">Try an example</p>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example) => <button key={example} type="button" onClick={() => setBrief(example)} className="rounded-full border border-white/[.09] bg-white/[.025] px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-violet-400/30 hover:text-white">{example}</button>)}
                </div>
              </div>

              <Field label="Desired outcome" hint="Optional"><Textarea name="desiredOutcome" maxLength={1000} className="min-h-24" placeholder="What would a successful result look like?" /></Field>

              <div className="grid gap-6 sm:grid-cols-[1fr_110px_1fr]">
                <Field label="Maximum budget" hint="Optional"><Input name="budget" inputMode="decimal" pattern="\d+(\.\d{1,2})?" placeholder="e.g. 100.00" /></Field>
                <Field label="Currency"><Input name="currency" defaultValue="USD" minLength={3} maxLength={12} className="uppercase" /></Field>
                <Field label="Preferred deadline" hint="Optional"><Input name="deadline" type="date" min={new Date().toISOString().slice(0, 10)} /></Field>
              </div>

              <Field label="Constraints, links, or context" hint="Optional · one item per line"><Textarea name="constraints" maxLength={8000} className="min-h-28" placeholder={"Use our existing brand colors\nThe site must work on mobile\nReference: https://example.com"} /></Field>

              <label className="flex items-start gap-3 rounded-xl border border-white/[.08] bg-black/20 p-4"><input name="agentSharingConsent" required type="checkbox" className="mt-0.5 size-4 accent-violet-600" /><span className="text-xs leading-5 text-zinc-500">I understand that Auvra may share the minimum necessary, sanitized task context with independent specialist agents after I approve the final scope and quote.</span></label>

              {error && <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[.06] p-4 text-sm leading-6 text-red-200">{error}</div>}

              <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[.08] pt-6 sm:flex-row sm:items-center"><p className="flex items-center gap-2 text-xs text-zinc-600"><LockKeyhole className="size-3.5" />Nothing is purchased without approval.</p><Button disabled={submitting} type="submit" variant="violet">{submitting ? <><LoaderCircle className="size-4 animate-spin" />Creating request…</> : <>Create request <ArrowRight className="size-4" /></>}</Button></div>
            </form>
          </Card>
        </div>

        <aside className="space-y-4 lg:pt-24">
          <Card className="p-6"><div className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Sparkles className="size-5" /></div><h2 className="mt-5 text-base font-medium">Auvra Manager</h2><p className="mt-2 text-xs leading-5 text-zinc-500">One request in. A scoped, priced, and coordinated service plan out.</p><div className="mt-6 space-y-5">{managerSteps.map(({icon:Icon,title,copy}, index)=><div key={title} className="flex gap-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-white/[.08] bg-black/20"><Icon className="size-3.5 text-violet-300" /></span><div><p className="text-xs font-medium text-zinc-300">0{index + 1} · {title}</p><p className="mt-1 text-[11px] leading-5 text-zinc-600">{copy}</p></div></div>)}</div></Card>
          <Card className="p-6"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">Before execution</p><ul className="mt-5 space-y-3 text-xs text-zinc-500">{["Feasibility is confirmed","Tasks and deliverables are visible","Supplier availability is checked","You approve the final quote","Payment is verified"].map(item=><li key={item} className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" />{item}</li>)}</ul></Card>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-zinc-300"><span>{label}</span>{hint && <span className="font-normal text-zinc-700">{hint}</span>}</span>{children}</label>;
}

function toMinorUnits(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  const [, whole, fraction = ""] = match;
  return `${whole}${fraction.padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}
