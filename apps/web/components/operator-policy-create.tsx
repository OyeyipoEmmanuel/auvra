"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ServiceOption = { id: string; name: string };

export function OperatorPolicyCreate({ services }: { services: ServiceOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [perJob, setPerJob] = useState("");
  const [project, setProject] = useState("");
  const [daily, setDaily] = useState("");
  const [floor, setFloor] = useState("0");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createPolicy() {
    if (busy || !confirmed || selected.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ops/policies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          serviceIds: selected,
          perJobCapMinor: perJob,
          projectCapMinor: project,
          dailyCapMinor: daily,
          contributionFloorMinor: floor,
          reason,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Policy creation failed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Policy creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 rounded-xl border border-zinc-700 bg-zinc-900/40 p-5">
      <h2 className="text-lg font-semibold">Set initial live procurement limits</h2>
      <p className="mt-2 text-[14px] leading-6 text-zinc-400">
        Choose only reviewed supplier services. This creates a paused policy; it does not prepare a
        hire or spend. Resume it separately after checking buyer funds and live payment settings.
      </p>
      {services.length ? (
        <div className="mt-5 space-y-2">
          <p className="text-[14px] font-medium text-zinc-300">Allowed supplier services</p>
          {services.map((service) => (
            <label
              key={service.id}
              className="flex items-start gap-3 text-[14px] text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selected.includes(service.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, service.id]
                      : current.filter((id) => id !== service.id),
                  )
                }
                className="mt-1 accent-violet-500"
              />
              <span>
                {service.name} · {service.id}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-[14px] text-amber-200">
          No supplier proposals yet. A live-funded project must reach a ready task first.
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Limit
          label="Per-job cap (USD cents)"
          value={perJob}
          onChange={setPerJob}
        />
        <Limit
          label="Per-project cap (USD cents)"
          value={project}
          onChange={setProject}
        />
        <Limit
          label="Daily cap (USD cents)"
          value={daily}
          onChange={setDaily}
        />
        <Limit
          label="Minimum customer contribution retained (USD cents)"
          value={floor}
          onChange={setFloor}
        />
      </div>
      <label
        className="mt-5 block text-[14px] text-zinc-300"
        htmlFor="initial-policy-reason"
      >
        Reason for this policy
      </label>
      <textarea
        id="initial-policy-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-[14px] text-white"
      />
      <label className="mt-4 flex items-start gap-2 text-[14px] text-zinc-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 accent-violet-500"
        />
        I reviewed these service IDs and spending limits. Create the policy in a paused state.
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
        disabled={busy || !confirmed || selected.length === 0 || reason.trim().length < 10}
        onClick={createPolicy}
        className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : "Create paused policy"}
      </button>
    </section>
  );
}

function Limit({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[14px] text-zinc-300">
      {label}
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-[14px] text-white"
      />
    </label>
  );
}
