"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OperatorApprovalButton({
  jobId,
  priceMinor,
  label,
}: {
  jobId: string;
  priceMinor: string;
  label: string;
}) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    if (!acknowledged || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/ops/supplier-jobs/${jobId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, expectedAmountMinor: priceMinor }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Approval failed.");
      setReviewing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7">
      {!reviewing ? (
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="rounded-lg bg-violet-600 px-5 py-3 text-[14px] font-semibold text-white hover:bg-violet-500"
        >
          Review exact approval
        </button>
      ) : (
        <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-5">
          <h2 className="text-lg font-semibold">Confirm this supplier proposal</h2>
          <p className="mt-2 text-[14px] leading-6 text-zinc-300">
            Approve {label} only. This records an internal spending approval; it does not hire or
            pay the agent. The marketplace approval page is a separate later step that can charge
            the buyer wallet.
          </p>
          <label className="mt-4 flex items-start gap-3 text-[14px] text-zinc-200">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 accent-violet-500"
            />
            I reviewed the exact supplier, task, price, currency, and customer funding evidence
            above.
          </label>
          {error && (
            <p
              role="alert"
              className="mt-3 text-[14px] text-rose-300"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={!acknowledged || busy}
              onClick={approve}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Recording…" : "Record approval"}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-[14px] text-zinc-200 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
