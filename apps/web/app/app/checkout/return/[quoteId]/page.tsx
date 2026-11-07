import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, ShieldCheck, TriangleAlert } from "lucide-react";

import { PaymentReturnWait } from "@/components/payment-return-wait";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ checkout_id?: string | string[] }>;
};

export default async function CheckoutReturnPage({ params, searchParams }: Context) {
  const user = await requirePageUser();
  const { quoteId } = await params;
  const { checkout_id: checkoutId } = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId)) {
    notFound();
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, request: { customerId: user.id } },
    select: { requestId: true, customerTotalMinor: true, currency: true },
  });
  if (!quote) notFound();

  const payment =
    typeof checkoutId === "string" && /^chk_[A-Za-z0-9_-]{1,100}$/.test(checkoutId)
      ? await prisma.customerPayment.findFirst({
          where: {
            quoteId,
            customerId: user.id,
            provider: { in: ["BACHS", "BACHS_SANDBOX"] },
            providerCheckoutId: checkoutId,
          },
          select: { state: true, projectId: true, provider: true },
        })
      : null;

  if (payment?.projectId && ["ALLOCATED", "RECONCILED"].includes(payment.state)) {
    redirect(`/app/projects/${payment.projectId}`);
  }

  const pending = payment && ["CREATED", "PENDING", "VERIFIED"].includes(payment.state);
  const held = payment && ["REFUND_PENDING", "REFUNDED", "DISPUTED"].includes(payment.state);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-5 py-12 sm:px-8">
      <Card className="w-full border-violet-400/20 p-6 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-violet-400/10 text-violet-200">
          {held || !payment ? (
            <TriangleAlert className="size-6" />
          ) : pending ? (
            <ShieldCheck className="size-6" />
          ) : (
            <CircleCheck className="size-6" />
          )}
        </span>
        <p className="mt-5 font-mono text-[12px] uppercase tracking-[.16em] text-violet-200">
          Bachs checkout return
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          {!payment
            ? "Checkout could not be matched"
            : held
              ? "Payment requires review"
              : pending
                ? "Waiting for payment verification"
                : "Payment was not completed"}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-zinc-400">
          {!payment
            ? "We could not match this Bachs return to your Auvra checkout. No project was started from this page."
            : held
              ? "This payment is on hold. Auvra will not hire a supplier while it is under review."
              : pending
                ? "Bachs returned you to Auvra. We are verifying the payment with Bachs before creating your project."
                : "The checkout did not produce a verified funded project. You can review your request and payment state below."}
        </p>
        {pending && <PaymentReturnWait quoteId={quoteId} />}
        {payment?.provider === "BACHS_SANDBOX" && (
          <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-4 text-[14px] leading-6 text-amber-100">
            Sandbox payment: no real money moved, and live agent hiring remains disabled.
          </p>
        )}
        <div className="mt-7 flex flex-wrap gap-4 text-[15px]">
          <Link
            href={`/app/requests/${quote.requestId}`}
            className="font-medium text-violet-200 hover:text-white"
          >
            Back to request
          </Link>
          <Link
            href="/app"
            className="text-zinc-400 hover:text-white"
          >
            Dashboard
          </Link>
        </div>
      </Card>
    </main>
  );
}
