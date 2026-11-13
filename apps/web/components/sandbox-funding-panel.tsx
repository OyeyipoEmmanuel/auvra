"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";

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
      if (!response.ok) throw new Error(body.error?.message ?? "The project could not be started.");
      if (body.projectId) router.push(`/app/projects/${body.projectId}`);
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The project could not be started.");
      setPending(false);
    }
  }

  return (
    <Card className="mt-6 border-violet-400/15 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-400/10">
          <ShieldCheck className="size-5 text-violet-200" />
        </span>
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[.14em] text-violet-200">
            Project setup
          </p>
          <h2 className="mt-2 text-xl font-medium">
            {projectId ? "Project ready" : "Continue to your project"}
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-zinc-400">
            {projectId
              ? "Your plan, workspace, and project receipt are ready."
              : `Start the project for the approved ${amount} quote.`}
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
          {error && (
            <p
              role="alert"
              className="mt-4 text-[15px] text-red-200"
            >
              {error}
            </p>
          )}
          <Button
            disabled={pending}
            onClick={() => void fund()}
            className="mt-5"
            variant="violet"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Start project
          </Button>
        </>
      )}
      <p className="mt-4 text-[14px] leading-5 text-zinc-500">
        No payment is collected at this step. Marketplace agents are not hired by this action.
      </p>
    </Card>
  );
}
