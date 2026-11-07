"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SandboxFundingPanel({
  quoteId,
  amount,
  projectId,
}: {
  quoteId: string;
  amount: string;
  projectId?: string;
}) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fund() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/sandbox-fund`, { method: "POST" });
      const body = (await response.json()) as {
        kind?: string;
        projectId?: string;
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(body.error?.message ?? "Demo funding could not be recorded.");
      if (body.projectId) router.push(`/app/projects/${body.projectId}`);
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo funding could not be recorded.");
      setPending(false);
    }
  }

  return (
    <Card className="mt-6 border-amber-300/20 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-300/10">
          <FlaskConical className="size-5 text-amber-200" />
        </span>
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[.14em] text-amber-200">
            Development sandbox
          </p>
          <h2 className="mt-2 text-xl font-medium">
            {projectId ? "Demo project created" : "Simulate funding for this quote"}
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-zinc-400">
            {projectId
              ? "The project and demo ledger are ready. No real tokens moved or supplier jobs started."
              : `Record ${amount} as simulated funds, reserve the supplier budget, and create project tasks. This does not connect a wallet or transfer testnet tokens.`}
          </p>
        </div>
      </div>
      {projectId ? (
        <Button
          asChild
          className="mt-6"
          variant="outline"
        >
          <Link href={`/app/projects/${projectId}`}>
            Open project <ArrowRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <>
          <label className="mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-4 accent-violet-600"
            />
            <span className="text-[14px] leading-5 text-zinc-400">
              I understand this is a development simulation. No NEAR or USDC tokens are transferred,
              and no supplier will be hired.
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="mt-4 text-[15px] text-red-200"
            >
              {error}
            </p>
          )}
          <Button
            disabled={!acknowledged || pending}
            onClick={() => void fund()}
            className="mt-5"
            variant="violet"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <FlaskConical className="size-4" />
            )}
            Create demo funded project
          </Button>
        </>
      )}
    </Card>
  );
}
