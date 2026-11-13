"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function VerifyProjectReceipt({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function verify() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/receipt/verify`, {
        method: "POST",
      });
      const body = (await response.json()) as { verified?: boolean; message?: string };
      if (!response.ok || !body.verified) {
        setMessage(body.message ?? "The receipt has not been confirmed on NEAR testnet yet.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("NEAR testnet could not be reached. Please try again shortly.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <Button
        disabled={pending}
        onClick={() => void verify()}
        variant="outline"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        Verify on NEAR
      </Button>
      {message && (
        <p
          className="mt-2 text-[14px] text-zinc-400"
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
