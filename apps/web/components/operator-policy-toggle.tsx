"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OperatorPolicyToggle({
  version,
  paused,
  canResume,
}: {
  version: number;
  paused: boolean;
  canResume: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nextPause = !paused;

  async function submit() {
    if (!confirmed || reason.trim().length < 10 || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ops/policies/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pause: nextPause,
          expectedVersion: version,
          reason,
          confirmed: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Policy change failed.");
      setReason("");
      setConfirmed(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Policy change failed.");
    } finally {
      setBusy(false);
    }
  }

  if (paused && !canResume)
    return (
      <p className="mt-4 text-[14px] text-amber-200">
        Only a live-mode administrator can resume procurement.
      </p>
    );
  return (
    <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900/50 p-5">
      <h3 className="text-[16px] font-semibold">
        {nextPause ? "Emergency pause" : "Resume procurement"}
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-zinc-400">
        {nextPause
          ? "Blocks new supplier reservations; monitoring and reconciliation continue."
          : "Re-enables policy evaluation only. It does not bypass payment, wallet, approval, or listing checks."}
      </p>
      <label
        className="mt-4 block text-[14px] text-zinc-300"
        htmlFor="policy-reason"
      >
        Reason
      </label>
      <textarea
        id="policy-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={3}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-[14px] text-white"
      />
      <label className="mt-3 flex items-center gap-2 text-[14px] text-zinc-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />{" "}
        I confirm this versioned policy change.
      </label>
      {error && (
        <p
          role="alert"
          className="mt-3 text-[14px] text-rose-300"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!confirmed || reason.trim().length < 10 || busy}
        onClick={submit}
        className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : nextPause ? "Pause new spending" : "Resume policy"}
      </button>
    </div>
  );
}
