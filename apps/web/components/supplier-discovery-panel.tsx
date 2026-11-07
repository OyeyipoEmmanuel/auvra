"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, RefreshCw, Search, Store } from "lucide-react";

import { AcceptQuoteButton } from "@/components/accept-quote-button";
import type { ManagerAnalysis } from "@/lib/manager-analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SupplierDiscoveryPanel({
  requestId,
  state,
  discovery,
  budgetMinor,
  budgetCurrency,
}: {
  requestId: string;
  state: string;
  discovery?: ManagerAnalysis["discovery"];
  budgetMinor: string | null;
  budgetCurrency: string | null;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState(state === "SCOPED" && !discovery);
  const [error, setError] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  useEffect(() => {
    if (state !== "SCOPED" || discovery || started.current) return;
    started.current = true;
    void discover();
  }, [state, discovery]);

  async function discover() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/discover`, { method: "POST" });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(data.error?.message ?? "Supplier discovery could not be completed.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Supplier discovery could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function increaseBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const match = budgetInput.trim().match(/^(\d{1,16})(?:\.(\d{1,2}))?$/);
    if (!match) {
      setError("Enter a valid amount with no more than two decimal places.");
      return;
    }
    const nextMinor = (
      BigInt(match[1]) * BigInt(100) +
      BigInt((match[2] ?? "").padEnd(2, "0"))
    ).toString();
    if (budgetMinor !== null && BigInt(nextMinor) <= BigInt(budgetMinor)) {
      setError("Enter an amount above your current budget.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetMinor: nextMinor }),
      });
      const data = (await response.json()) as {
        rediscover?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(data.error?.message ?? "The budget could not be updated.");
      if (data.rediscover) {
        await discover();
      } else {
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The budget could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if (state !== "SCOPED" && state !== "QUOTED" && state !== "APPROVED") return null;

  if (busy)
    return (
      <Card className="mt-6 border-violet-400/15 p-6 sm:p-8">
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10">
            <LoaderCircle className="size-5 animate-spin text-violet-300" />
          </span>
          <div>
            <Badge>Live catalog search</Badge>
            <h2 className="mt-3 text-xl">Checking supplier coverage and prices</h2>
            <p className="mt-2 text-[15px] leading-6 text-zinc-500">
              Auvra is reading current NEAR Agent Market listings. It will not hire, reserve,
              message, or pay any supplier.
            </p>
          </div>
        </div>
      </Card>
    );

  if (!discovery)
    return (
      <Card className="mt-6 p-6 sm:p-8">
        <Store className="size-5 text-violet-300" />
        <h2 className="mt-4 text-xl">Supplier discovery is ready</h2>
        <p className="mt-2 text-[15px] text-zinc-500">
          Search the live catalog for task coverage and current prices.
        </p>
        {error && <ErrorMessage message={error} />}
        <Button
          onClick={() => void discover()}
          variant="violet"
          className="mt-5"
        >
          <Search className="size-4" />
          Search live marketplace
        </Button>
      </Card>
    );

  const overBudget = discovery.status === "OVER_BUDGET";
  const unavailable = discovery.status === "NOT_AVAILABLE";
  const quotedCurrency = discovery.quotedCurrency ?? budgetCurrency ?? "USD";
  return (
    <Card
      className={`mt-6 overflow-hidden ${unavailable || overBudget ? "border-amber-300/15" : "border-emerald-400/15"}`}
    >
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={unavailable || overBudget ? "warning" : "success"}>
            {discovery.status.replaceAll("_", " ")}
          </Badge>
          <Badge variant="neutral">{discovery.catalogServiceCount} live services checked</Badge>
          <Badge variant="neutral">{discovery.eligibleMatchCount} eligible matches</Badge>
        </div>
        <h2 className="mt-5 text-xl">
          {overBudget
            ? "Supplier coverage found — quote above budget"
            : unavailable
              ? "Supplier coverage is incomplete"
              : "Supplier coverage verified"}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-zinc-500">{discovery.explanation}</p>
        {overBudget && budgetMinor && budgetCurrency && (
          <div className="mt-5 grid gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <p className="text-[13px] text-zinc-500">Your current budget</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {formatMinor(budgetMinor, budgetCurrency)}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-zinc-500">Observed total quote</p>
              <p className="mt-1 text-xl font-semibold text-amber-100">
                {discovery.quotedTotalMinor
                  ? formatMinor(discovery.quotedTotalMinor, quotedCurrency)
                  : "Review updated quote"}
              </p>
            </div>
          </div>
        )}
        {overBudget && (state === "SCOPED" || state === "QUOTED") && (
          <div className="mt-5 flex flex-wrap gap-3">
            {state === "QUOTED" && discovery.quoteId && (
              <a
                href="#project-quote"
                className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-[15px] font-medium text-zinc-200 transition hover:bg-white/[.06] focus-visible:outline-2 focus-visible:outline-violet-400"
              >
                Review full quote
              </a>
            )}
            {budgetMinor && budgetCurrency && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setBudgetOpen((open) => !open)}
              >
                Increase budget
              </Button>
            )}
            {discovery.quoteId && discovery.quotedTotalMinor && state === "QUOTED" ? (
              <AcceptQuoteButton
                quoteId={discovery.quoteId}
                totalMinor={discovery.quotedTotalMinor}
                currency={quotedCurrency}
                budgetMinor={budgetMinor}
                budgetCurrency={budgetCurrency}
                aboveBudget={overBudget}
                label="Accept higher quote"
              />
            ) : state === "SCOPED" ? (
              <Button
                type="button"
                variant="violet"
                disabled={busy}
                onClick={() => void discover()}
              >
                Review higher quote
              </Button>
            ) : null}
          </div>
        )}
        {budgetOpen && budgetCurrency && (
          <form
            onSubmit={(event) => void increaseBudget(event)}
            className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
          >
            <label
              htmlFor={`increase-budget-${requestId}`}
              className="block text-[15px] font-medium text-zinc-200"
            >
              New maximum budget ({budgetCurrency})
            </label>
            <p className="mt-1 text-[14px] leading-5 text-zinc-500">
              Enter a higher amount. This changes your ceiling only; it does not pay or hire anyone.
              If there is no quote yet, Auvra will recheck current supplier prices.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input
                id={`increase-budget-${requestId}`}
                type="text"
                inputMode="decimal"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                placeholder={
                  discovery.quotedTotalMinor ? minorToDecimal(discovery.quotedTotalMinor) : "0.00"
                }
                className="min-w-40 flex-1 rounded-xl border border-white/15 bg-[#111115] px-4 py-2.5 text-[15px] text-white outline-none focus:border-violet-400"
              />
              <Button
                type="submit"
                variant="violet"
                disabled={busy}
              >
                {busy && <LoaderCircle className="size-4 animate-spin" />}
                Save higher budget
              </Button>
            </div>
          </form>
        )}
      </div>

      {discovery.selected.length > 0 && (
        <div className="border-t border-white/[.08]">
          <div className="px-6 pt-6 sm:px-8">
            <p className="font-mono text-[12px] uppercase tracking-[.14em] text-zinc-600">
              Best observed candidates
            </p>
          </div>
          <div className="divide-y divide-white/[.07]">
            {discovery.selected.map((selection) => (
              <div
                key={selection.taskKey}
                className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8"
              >
                <div>
                  <p className="text-[15px] font-medium text-zinc-200">{selection.serviceName}</p>
                  <p className="mt-1 text-[14px] text-zinc-600">
                    Task: {selection.taskKey.replaceAll("_", " ")} · Match score {selection.score}
                  </p>
                  <p className="mt-2 text-[14px] text-zinc-500">{selection.reasons[0]}</p>
                </div>
                <p className="text-[15px] font-medium text-emerald-200">
                  {formatMinor(selection.priceMinor, selection.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {discovery.missingTaskKeys.length > 0 && (
        <div className="border-t border-white/[.08] bg-amber-300/[.025] p-6 sm:px-8">
          <p className="flex items-center gap-2 text-[15px] font-medium text-amber-100">
            <AlertTriangle className="size-4" />
            Tasks without verified coverage
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {discovery.missingTaskKeys.map((task) => (
              <Badge
                key={task}
                variant="warning"
              >
                {task.replaceAll("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 border-t border-white/[.08] bg-black/20 p-6 sm:flex-row sm:items-center sm:px-8">
        <p className="text-[14px] text-zinc-600">
          Observed {new Date(discovery.observedAt).toLocaleString()}. Catalog observations expire;
          no availability is reserved.
        </p>
        {state === "SCOPED" && (
          <Button
            onClick={() => void discover()}
            disabled={busy}
            variant="outline"
          >
            <RefreshCw className="size-4" />
            Search again
          </Button>
        )}
      </div>
      {error && (
        <div className="px-6 pb-6 sm:px-8">
          <ErrorMessage message={error} />
        </div>
      )}
    </Card>
  );
}

function formatMinor(value: string, currency: string) {
  const padded = value.padStart(3, "0");
  return `${currency} ${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function minorToDecimal(value: string) {
  const padded = value.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-4 flex gap-2 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-[15px] text-red-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  );
}
