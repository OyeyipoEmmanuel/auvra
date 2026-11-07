"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CustomerDeliveryAccept({
  projectId,
  artifactIds,
}: {
  projectId: string;
  artifactIds: string[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/accept-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactIds, confirmed: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not accept this delivery.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept this delivery.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
      <h2 className="text-[16px] font-semibold text-white">Review your delivery</h2>
      <p className="mt-2 text-[14px] leading-6 text-[#a1a1aa]">
        Acceptance confirms the deliverables listed above. It does not itself accept a supplier
        result on NEAR Agent Market or close the financial settlement.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-violet-500"
        >
          Accept these deliverables
        </button>
      ) : (
        <div className="mt-4">
          <p className="text-[14px] text-white">
            Accept exactly {artifactIds.length} reviewed deliverable
            {artifactIds.length === 1 ? "" : "s"}?
          </p>
          {error && (
            <p
              role="alert"
              className="mt-2 text-[14px] text-rose-300"
            >
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={accept}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Recording…" : "Confirm acceptance"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-[#494950] px-5 py-2.5 text-[14px] text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
