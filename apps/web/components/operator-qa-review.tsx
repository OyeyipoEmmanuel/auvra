"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperatorQaReview({ artifactId, checks }: { artifactId: string; checks: string[] }) {
  const router = useRouter();
  const [passedChecks, setPassedChecks] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: "PASSED" | "REJECTED") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/ops/artifacts/${artifactId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, passedChecks, notes }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Review could not be saved.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold">Human quality review</h2>
      <p className="mt-2 text-[14px] leading-6 text-zinc-400">
        Check the actual deliverable against every acceptance criterion. This decision does not
        accept the supplier result or release marketplace funds.
      </p>
      <div className="mt-5 space-y-3">
        {checks.map((check) => (
          <label
            key={check}
            className="flex items-start gap-3 text-[14px] text-zinc-200"
          >
            <input
              type="checkbox"
              checked={passedChecks.includes(check)}
              onChange={(event) =>
                setPassedChecks((current) =>
                  event.target.checked
                    ? [...current, check]
                    : current.filter((item) => item !== check),
                )
              }
              className="mt-1 accent-violet-500"
            />
            {check}
          </label>
        ))}
      </div>
      <label
        className="mt-5 block text-[14px] text-zinc-300"
        htmlFor="qa-notes"
      >
        Evidence and reviewer notes (at least 10 characters)
      </label>
      <textarea
        id="qa-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={4000}
        rows={5}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-[14px] text-white"
      />
      {error && (
        <p
          role="alert"
          className="mt-3 text-[14px] text-red-300"
        >
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || notes.trim().length < 10 || passedChecks.length !== checks.length}
          onClick={() => void submit("PASSED")}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Mark QA passed
        </button>
        <button
          type="button"
          disabled={pending || notes.trim().length < 10 || passedChecks.length === checks.length}
          onClick={() => void submit("REJECTED")}
          className="rounded-lg border border-amber-700 px-4 py-2.5 text-[14px] font-semibold text-amber-200 disabled:opacity-50"
        >
          Request correction locally
        </button>
      </div>
    </section>
  );
}
