"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PencilLine, X } from "lucide-react";

import { AcceptQuoteButton } from "@/components/accept-quote-button";
import { Button } from "@/components/ui/button";

type ApiError = { error?: { message?: string } };

export function QuoteActions({
  quoteId,
  totalMinor,
  currency,
  budgetMinor,
  budgetCurrency,
  aboveBudget,
}: {
  quoteId: string;
  totalMinor: string;
  currency: string;
  budgetMinor: string | null;
  budgetCurrency: string | null;
  aboveBudget: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reject" | "revise" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [change, setChange] = useState("");

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/reject`, { method: "POST" });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "The quote could not be updated.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The quote could not be updated.");
      setBusy(null);
    }
  }

  async function reviseScope() {
    setBusy("revise");
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change }),
      });
      const data = (await response.json()) as ApiError;
      if (!response.ok) throw new Error(data.error?.message ?? "The scope could not be revised.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The scope could not be revised.");
      setBusy(null);
    }
  }

  return (
    <div className="border-t border-white/[.08] p-6 sm:p-8">
      {revisionOpen && (
        <div className="mb-5 rounded-xl border border-violet-400/20 bg-violet-400/[.04] p-4">
          <label
            htmlFor={`quote-revision-${quoteId}`}
            className="block text-[14px] font-medium text-zinc-200"
          >
            What should change in the scope?
          </label>
          <textarea
            id={`quote-revision-${quoteId}`}
            value={change}
            onChange={(event) => setChange(event.target.value)}
            minLength={12}
            maxLength={2000}
            rows={4}
            className="mt-3 w-full rounded-lg border border-white/15 bg-black/30 p-3 text-[14px] text-white outline-none focus:border-violet-400"
            placeholder="Describe the new deliverables, removed work, or other scope changes. Auvra will check suppliers and calculate a new quote."
          />
          <p className="mt-2 text-[13px] text-zinc-500">
            The current quote will be superseded. Nothing is spent.
          </p>
          <Button
            type="button"
            variant="violet"
            disabled={busy !== null || change.trim().length < 12}
            onClick={() => void reviseScope()}
            className="mt-4"
          >
            {busy === "revise" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <PencilLine className="size-4" />
            )}
            Request new quote
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 text-[15px] text-red-200"
        >
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          disabled={busy !== null}
          variant="outline"
          onClick={() => setRevisionOpen((open) => !open)}
        >
          <PencilLine className="size-4" /> Revise scope
        </Button>
        <Button
          disabled={busy !== null}
          variant="ghost"
          onClick={() => void reject()}
        >
          {busy === "reject" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          Reject quote
        </Button>
        <AcceptQuoteButton
          quoteId={quoteId}
          totalMinor={totalMinor}
          currency={currency}
          budgetMinor={budgetMinor}
          budgetCurrency={budgetCurrency}
          aboveBudget={aboveBudget}
        />
      </div>
    </div>
  );
}
