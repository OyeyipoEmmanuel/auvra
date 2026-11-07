"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  quoteId: string;
  totalMinor: string;
  currency: string;
  budgetMinor: string | null;
  budgetCurrency: string | null;
  aboveBudget: boolean;
  label?: string;
};

export function AcceptQuoteButton({
  quoteId,
  totalMinor,
  currency,
  budgetMinor,
  budgetCurrency,
  aboveBudget,
  label = "Accept scope and quote",
}: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedTotalMinor: totalMinor,
          acknowledgeOverBudget: aboveBudget,
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok || !data || "error" in data) {
        throw new Error(data.error?.message ?? "The quote could not be accepted.");
      }
      dialog.current?.close();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The quote could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="violet"
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        <Check className="size-4" />
        {label}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`accept-quote-title-${quoteId}`}
        className="w-[min(100%-2rem,32rem)] mx-auto flex items-center justify-center rounded-2xl border border-white/15 bg-[#18171e] p-0 text-white shadow-2xl backdrop:bg-black/75"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
              {aboveBudget ? <AlertTriangle className="size-5" /> : <Check className="size-5" />}
            </span>
            <button
              type="button"
              aria-label="Close confirmation"
              disabled={busy}
              onClick={() => dialog.current?.close()}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
          <h2
            id={`accept-quote-title-${quoteId}`}
            className="mt-5 text-2xl font-semibold tracking-tight"
          >
            {aboveBudget ? "Confirm the higher quote" : "Accept this quote?"}
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-zinc-400">
            You are approving the displayed scope and total price of{" "}
            <strong className="text-white">{formatMinor(totalMinor, currency)}</strong>.
          </p>
          {aboveBudget && (
            <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-[15px] leading-6 text-amber-100">
              This exceeds your current budget of {formatMinor(budgetMinor!, budgetCurrency!)}.
              Confirming explicitly accepts the higher quoted price; it does not change your budget
              ceiling.
            </p>
          )}
          <p className="mt-4 text-[14px] leading-6 text-zinc-400">
            No payment is taken and no supplier is hired now. Funding is a separate next step.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 text-[14px] text-red-200"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Keep reviewing
            </Button>
            <Button
              type="button"
              variant="violet"
              disabled={busy}
              onClick={() => void accept()}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Confirm acceptance
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function formatMinor(value: string, currency: string) {
  const padded = value.padStart(3, "0");
  return `${currency} ${padded.slice(0, -2)}.${padded.slice(-2)}`;
}
