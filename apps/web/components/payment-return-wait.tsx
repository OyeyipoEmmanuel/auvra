"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PaymentReturnWait({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const initialCheck = useRef(false);

  const checkProvider = useCallback(async () => {
    setCheckingProvider(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/reconcile`, { method: "POST" });
      const result = (await response.json()) as {
        kind?: string;
        projectId?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(result.message ?? "Payment could not be checked right now.");
      if (["VERIFIED", "ALREADY_VERIFIED"].includes(result.kind ?? "") && result.projectId) {
        router.replace(`/app/projects/${result.projectId}`);
        return;
      }
      setNotice("Bachs has not confirmed this payment yet. Please check again shortly.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment could not be checked right now.");
    } finally {
      setCheckingProvider(false);
    }
  }, [quoteId, router]);

  useEffect(() => {
    if (initialCheck.current) return;
    initialCheck.current = true;
    void checkProvider();
  }, [checkProvider]);

  useEffect(() => {
    if (checks >= 40) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setChecks((count) => count + 1);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [checks, router]);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[.03] p-4">
      <div
        role="status"
        className="flex items-center gap-3 text-[15px] text-zinc-300"
      >
        {checks < 40 ? (
          <LoaderCircle className="size-4 animate-spin text-violet-300" />
        ) : (
          <RefreshCw className="size-4 text-amber-200" />
        )}
        {checks < 40 ? "Checking for verified payment…" : "Still waiting for Bachs confirmation."}
      </div>
      <p className="mt-2 text-[14px] leading-5 text-zinc-500">
        The checkout screen alone does not confirm funding. If this takes more than a few minutes,
        use Check again. Auvra will verify the payment directly with Bachs if the webhook is
        delayed.
      </p>
      {notice && (
        <p
          role="status"
          className="mt-3 text-[14px] text-amber-200"
        >
          {notice}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={checkingProvider}
        onClick={() => void checkProvider()}
      >
        <RefreshCw className={checkingProvider ? "size-4 animate-spin" : "size-4"} /> Check again
      </Button>
    </div>
  );
}
