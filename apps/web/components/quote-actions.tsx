"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuoteActions({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "accept" | "reject") {
    setBusy(decision);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/${decision}`, { method: "POST" });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "The quote could not be updated.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The quote could not be updated.");
      setBusy(null);
    }
  }

  return <div className="border-t border-white/[.08] p-6 sm:p-8"><label className="flex items-start gap-3 rounded-xl border border-white/[.08] bg-black/20 p-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-violet-600" /><span className="text-xs leading-5 text-zinc-400">I understand that accepting approves this scope and price but does not move funds or hire suppliers. Funding is a separate next step.</span></label>{error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button disabled={busy !== null} variant="ghost" onClick={() => void decide("reject")}>{busy === "reject" ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}Reject quote</Button><Button disabled={!confirmed || busy !== null} variant="violet" onClick={() => void decide("accept")}>{busy === "accept" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Accept scope and quote</Button></div></div>;
}
