"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";

import type { ManagerAnalysis } from "@/lib/manager-analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  requestId: string;
  state: string;
  analysis: ManagerAnalysis | null;
};

export function ManagerPanel({ requestId, state, analysis }: Props) {
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState(state === "SUBMITTED" || state === "ANALYZING");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ((state !== "SUBMITTED" && state !== "ANALYZING") || started.current) return;
    started.current = true;
    void analyze();
  }, [state]);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/analyze`, { method: "POST" });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(data.error?.message ?? "Manager analysis could not be completed.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Manager analysis could not be completed.",
      );
      setBusy(false);
    }
  }

  async function submitClarifications(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysis || busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const answers = analysis.questions.map((question) => ({
      questionId: question.id,
      answer: String(form.get(question.id) ?? "").trim(),
    }));
    try {
      const response = await fetch(`/api/requests/${requestId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Your answers could not be saved.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your answers could not be saved.");
      setBusy(false);
    }
  }

  if (busy || state === "ANALYZING") {
    return (
      <Card className="mt-6 overflow-hidden border-violet-400/15">
        <div className="flex items-start gap-4 p-6 sm:p-8">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10">
            <LoaderCircle className="size-5 animate-spin text-violet-300" />
          </span>
          <div>
            <Badge>Manager active</Badge>
            <h2 className="mt-4 text-xl tracking-[-.03em]">Analyzing your request</h2>
            <p className="mt-2 text-[15px] leading-6 text-zinc-500">
              Auvra is identifying the service category, missing requirements, deliverables,
              dependencies, and acceptance checks.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (state === "SUBMITTED") {
    return (
      <Card className="mt-6 p-6">
        <p className="text-[15px] text-zinc-400">Manager analysis is ready to begin.</p>
        <Button
          className="mt-4"
          variant="violet"
          onClick={() => void analyze()}
        >
          Analyze request <ArrowRight className="size-4" />
        </Button>
        {error && <ErrorMessage message={error} />}
      </Card>
    );
  }

  if (!analysis) return error ? <ErrorMessage message={error} /> : null;

  if (analysis.decision === "NEEDS_CLARIFICATION") {
    return (
      <Card className="mt-6 overflow-hidden border-amber-300/15">
        <div className="border-b border-white/[.08] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-300/10">
              <Sparkles className="size-4 text-amber-200" />
            </span>
            <div>
              <Badge variant="warning">Clarification needed</Badge>
              <h2 className="mt-2 text-xl tracking-[-.03em]">Help Auvra complete the scope</h2>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-zinc-500">
            {analysis.decisionReason}
          </p>
        </div>
        <form
          onSubmit={submitClarifications}
          className="space-y-6 p-6 sm:p-8"
        >
          {analysis.questions.map((question, index) => (
            <label
              key={question.id}
              className="block"
            >
              <span className="text-[15px] font-medium text-zinc-200">
                {index + 1}. {question.prompt}
              </span>
              <span className="mt-1 block text-[14px] leading-5 text-zinc-600">
                {question.reason}
              </span>
              <Textarea
                required
                maxLength={2000}
                name={question.id}
                className="mt-3 min-h-24"
                placeholder="Your answer"
              />
            </label>
          ))}
          {error && <ErrorMessage message={error} />}
          <div className="flex justify-end border-t border-white/[.08] pt-6">
            <Button
              disabled={busy}
              type="submit"
              variant="violet"
            >
              Submit answers <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  if (analysis.decision === "UNSUPPORTED") {
    return (
      <Card className="mt-6 border-red-400/15 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <CircleAlert className="size-5 text-red-300" />
          <Badge className="border-red-400/20 bg-red-400/10 text-red-200">Cannot proceed</Badge>
        </div>
        <h2 className="mt-5 text-xl">This request is unsupported</h2>
        <p className="mt-2 text-[15px] leading-6 text-zinc-500">{analysis.decisionReason}</p>
      </Card>
    );
  }

  if (!analysis.plan) return null;
  return (
    <Card className="mt-6 overflow-hidden border-emerald-400/15">
      <div className="border-b border-white/[.08] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success">Initial scope ready</Badge>
          <Badge variant="neutral">{analysis.categoryLabel}</Badge>
        </div>
        <h2 className="mt-5 text-2xl tracking-[-.04em]">{analysis.plan.title}</h2>
        <p className="mt-2 text-[15px] leading-6 text-zinc-400">{analysis.plan.objective}</p>
        <p className="mt-4 text-[14px] leading-5 text-zinc-600">{analysis.marketplace.note}</p>
      </div>
      <div className="divide-y divide-white/[.08]">
        {analysis.plan.tasks.map((task, index) => (
          <div
            key={task.key}
            className="grid gap-5 p-6 sm:grid-cols-[44px_1fr] sm:p-8"
          >
            <span className="grid size-10 place-items-center rounded-xl border border-white/[.08] bg-black/20 font-mono text-[14px] text-violet-300">
              0{index + 1}
            </span>
            <div>
              <h3 className="text-base font-medium text-zinc-100">{task.title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-zinc-500">{task.objective}</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <PlanList
                  title="Deliverables"
                  items={task.deliverables}
                />
                <PlanList
                  title="Acceptance checks"
                  items={task.acceptanceCriteria}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {task.capabilities.map((capability) => (
                  <Badge
                    key={capability}
                    variant="neutral"
                  >
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[.08] bg-black/20 p-6 sm:px-8">
        <p className="text-[14px] leading-5 text-zinc-600">
          Next: Auvra will search genuine marketplace services, verify availability and prices, then
          calculate a quote. This plan does not authorize spending.
        </p>
      </div>
    </Card>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[12px] uppercase tracking-[.14em] text-zinc-600">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[14px] leading-5 text-zinc-400"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-[15px] text-red-200"
    >
      {message}
    </div>
  );
}
