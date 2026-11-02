"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, LoaderCircle, RefreshCw, Search, Store } from "lucide-react";

import type { ManagerAnalysis } from "@/lib/manager-analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SupplierDiscoveryPanel({ requestId, state, discovery }: { requestId: string; state: string; discovery?: ManagerAnalysis["discovery"] }) {
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState(state === "SCOPED" && !discovery);
  const [error, setError] = useState<string | null>(null);

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
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Supplier discovery could not be completed.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Supplier discovery could not be completed.");
      setBusy(false);
    }
  }

  if (state !== "SCOPED" && state !== "QUOTED" && state !== "APPROVED") return null;

  if (busy) return <Card className="mt-6 border-violet-400/15 p-6 sm:p-8"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10"><LoaderCircle className="size-5 animate-spin text-violet-300" /></span><div><Badge>Live catalog search</Badge><h2 className="mt-3 text-xl">Checking supplier coverage and prices</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Auvra is reading current NEAR Agent Market listings. It will not hire, reserve, message, or pay any supplier.</p></div></div></Card>;

  if (!discovery) return <Card className="mt-6 p-6 sm:p-8"><Store className="size-5 text-violet-300" /><h2 className="mt-4 text-xl">Supplier discovery is ready</h2><p className="mt-2 text-sm text-zinc-500">Search the live catalog for task coverage and current prices.</p>{error && <ErrorMessage message={error} />}<Button onClick={() => void discover()} variant="violet" className="mt-5"><Search className="size-4" />Search live marketplace</Button></Card>;

  const unavailable = discovery.status !== "READY_FOR_QUOTE";
  return (
    <Card className={`mt-6 overflow-hidden ${unavailable ? "border-amber-300/15" : "border-emerald-400/15"}`}>
      <div className="p-6 sm:p-8"><div className="flex flex-wrap items-center gap-3"><Badge variant={unavailable ? "warning" : "success"}>{discovery.status.replaceAll("_", " ")}</Badge><Badge variant="neutral">{discovery.catalogServiceCount} live services checked</Badge><Badge variant="neutral">{discovery.eligibleMatchCount} eligible matches</Badge></div><h2 className="mt-5 text-xl">{unavailable ? "Supplier coverage is incomplete" : "Supplier coverage verified"}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{discovery.explanation}</p></div>

      {discovery.selected.length > 0 && <div className="border-t border-white/[.08]"><div className="px-6 pt-6 sm:px-8"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">Best observed candidates</p></div><div className="divide-y divide-white/[.07]">{discovery.selected.map((selection) => <div key={selection.taskKey} className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8"><div><p className="text-sm font-medium text-zinc-200">{selection.serviceName}</p><p className="mt-1 text-xs text-zinc-600">Task: {selection.taskKey.replaceAll("_", " ")} · Match score {selection.score}</p><p className="mt-2 text-xs text-zinc-500">{selection.reasons[0]}</p></div><p className="text-sm font-medium text-emerald-200">{formatMinor(selection.priceMinor, selection.currency)}</p></div>)}</div></div>}

      {discovery.missingTaskKeys.length > 0 && <div className="border-t border-white/[.08] bg-amber-300/[.025] p-6 sm:px-8"><p className="flex items-center gap-2 text-sm font-medium text-amber-100"><AlertTriangle className="size-4" />Tasks without verified coverage</p><div className="mt-3 flex flex-wrap gap-2">{discovery.missingTaskKeys.map((task) => <Badge key={task} variant="warning">{task.replaceAll("_", " ")}</Badge>)}</div></div>}

      <div className="flex flex-col justify-between gap-4 border-t border-white/[.08] bg-black/20 p-6 sm:flex-row sm:items-center sm:px-8"><p className="text-xs text-zinc-600">Observed {new Date(discovery.observedAt).toLocaleString()}. Catalog observations expire; no availability is reserved.</p>{state === "SCOPED" && <Button onClick={() => void discover()} disabled={busy} variant="outline"><RefreshCw className="size-4" />Search again</Button>}</div>
      {error && <div className="px-6 pb-6 sm:px-8"><ErrorMessage message={error} /></div>}
    </Card>
  );
}

function formatMinor(value: string, currency: string) {
  const padded = value.padStart(3, "0");
  return `${currency} ${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{message}</div>;
}
