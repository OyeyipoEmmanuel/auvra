"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LiveCheckoutPanel({
  quoteId,
  amount,
  mode,
  returnAvailable,
  paymentState,
}: {
  quoteId: string;
  amount: string;
  mode: "SANDBOX" | "LIVE";
  returnAvailable: boolean;
  paymentState: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasCheckout = paymentState === "PENDING";

  async function checkPayment() {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/reconcile`, { method: "POST" });
      const result = (await response.json()) as {
        kind?: string;
        projectId?: string | null;
        message?: string;
      };
      if (!response.ok)
        throw new Error(result.message ?? "Payment could not be checked right now.");
      if (["VERIFIED", "ALREADY_VERIFIED"].includes(result.kind ?? "") && result.projectId) {
        router.replace(`/app/projects/${result.projectId}`);
        return;
      }
      if (result.kind === "PAYMENT_NOT_CONFIRMED") {
        setNotice("Bachs has not confirmed this payment yet. Please check again shortly.");
      } else {
        setNotice("Payment still needs review. Do not start another checkout.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be checked.");
    } finally {
      setPending(false);
    }
  }

  async function beginCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/checkout`, { method: "POST" });
      const result = (await response.json()) as {
        kind?: string;
        authorizationUrl?: string;
      };
      if (!response.ok || result.kind !== "CHECKOUT_READY" || !result.authorizationUrl)
        throw new Error("Checkout is unavailable for this quote. Please refresh and try again.");
      const destination = new URL(result.authorizationUrl);
      if (
        destination.protocol !== "https:" ||
        !(
          destination.hostname === "checkout.bachs.io" ||
          (mode === "SANDBOX" && destination.hostname === "sandbox-checkout.bachs.io")
        ) ||
        !destination.pathname.startsWith("/c/")
      )
        throw new Error("The payment link could not be verified.");
      window.location.assign(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
      setPending(false);
    }
  }

  return (
    <Card className="mt-6 border-violet-300/20 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-300/10">
          <ShieldCheck className="size-5 text-violet-200" />
        </span>
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[.14em] text-violet-200">
            {hasCheckout ? "Payment verification" : "Secure checkout"}
          </p>
          <h2 className="mt-2 text-xl font-medium">
            {hasCheckout ? "Waiting for payment verification" : "Fund your project"}
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-zinc-400">
            {hasCheckout
              ? `A Bachs checkout for ${amount} already exists. Do not pay again. Auvra will create your project only after checking the provider's payment record.`
              : `Continue to Bachs to review and pay ${amount}. ${mode === "SANDBOX" ? "This is a simulated sandbox payment; no real money moves and live agent hiring stays blocked." : "Auvra starts the project only after the payment is verified. Supplier hiring requires a separate funding and approval check."}`}
          </p>
          {!hasCheckout && !returnAvailable && (
            <p className="mt-3 text-[14px] leading-6 text-amber-200">
              This app is not using a public HTTPS return URL, so Bachs cannot redirect back
              automatically. Return to this request manually after checkout and use Check payment
              status. Auvra will verify with Bachs before the project starts.
            </p>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 text-[15px] text-red-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 text-[15px] text-amber-200"
        >
          {notice}
        </p>
      )}
      {paymentState && !["CREATED", "PENDING"].includes(paymentState) && (
        <p className="mt-4 text-[15px] text-amber-200">
          This checkout is {paymentState.toLowerCase().replaceAll("_", " ")}. Contact support before
          trying another payment.
        </p>
      )}
      <Button
        disabled={
          pending || Boolean(paymentState && !["CREATED", "PENDING"].includes(paymentState))
        }
        onClick={() => void (hasCheckout ? checkPayment() : beginCheckout())}
        className="mt-6"
        variant="violet"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : hasCheckout ? (
          <RefreshCw className="size-4" />
        ) : (
          <ArrowUpRight className="size-4" />
        )}
        {hasCheckout
          ? "Check payment status"
          : `Continue to Bachs ${mode === "SANDBOX" ? "sandbox" : "checkout"}`}
      </Button>
    </Card>
  );
}
