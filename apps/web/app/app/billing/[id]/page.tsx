import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { StateDot, formatMoney } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const payment = await prisma.customerPayment.findFirst({
    where: { id, customerId: user.id },
    include: {
      quote: { select: { version: true, customerTotalMinor: true, currency: true } },
      project: {
        select: {
          id: true,
          state: true,
          receipts: {
            where: { kind: "SETTLEMENT" },
            select: { network: true, state: true, transactionHash: true, contractAccount: true },
          },
        },
      },
    },
  });
  if (!payment) notFound();
  const sandbox = payment.provider !== "BACHS";
  const proof = payment.project?.receipts.find((item) => item.state === "CONFIRMED");
  const explorer =
    proof?.transactionHash && proof.network === "mainnet"
      ? `https://nearblocks.io/txns/${encodeURIComponent(proof.transactionHash)}`
      : proof?.transactionHash && proof.network === "testnet"
        ? `https://testnet.nearblocks.io/txns/${encodeURIComponent(proof.transactionHash)}`
        : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <Link
        href="/app/billing"
        className="inline-flex items-center gap-2 text-[14px] text-[#92929b] hover:text-white"
      >
        <ArrowLeft
          className="size-4"
          aria-hidden="true"
        />{" "}
        Back to billing
      </Link>
      <div className="mt-8 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-6 sm:p-8">
        <p className="text-[13px] font-medium uppercase tracking-[.14em] text-violet-300">
          {sandbox ? "Simulated payment record" : "Customer payment record"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          {formatMoney(payment.amountMinor, payment.currency)}
        </h1>
        <div className="mt-4">
          <StateDot state={payment.state} />
        </div>
        <dl className="mt-8 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)] text-[14px]">
          <Row
            label="Reference"
            value={payment.id.toUpperCase()}
          />
          <Row
            label="Provider"
            value={payment.provider}
          />
          <Row
            label="Quote version"
            value={String(payment.quote.version)}
          />
          <Row
            label="Created"
            value={payment.createdAt.toLocaleString()}
          />
          <Row
            label="Charge verified"
            value={payment.verifiedAt?.toLocaleString() ?? "Not verified"}
          />
          <Row
            label="Settlement reconciled"
            value={payment.reconciledAt?.toLocaleString() ?? "Not reconciled"}
          />
        </dl>
        {payment.project && (
          <Link
            href={`/app/projects/${payment.project.id}`}
            className="mt-6 inline-block text-[14px] text-violet-300 hover:text-white"
          >
            View project{" "}
            <ExternalLink
              className="inline size-3.5"
              aria-hidden="true"
            />
          </Link>
        )}
        {explorer && (
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-[14px] text-violet-300 hover:text-white"
          >
            View {proof?.network} settlement proof{" "}
            <ExternalLink
              className="inline size-3.5"
              aria-hidden="true"
            />
          </a>
        )}
        <p className="mt-8 text-[14px] leading-6 text-[#92929b]">
          {sandbox
            ? "This is a development record, not an invoice, charge, or transferable token."
            : payment.reconciledAt
              ? "The payment is reconciled in Auvra’s records. An invoice is not available until provider settlement details are verified."
              : "A checkout success screen is not proof of settlement. Auvra will mark this reconciled only after provider and ledger checks pass."}
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 py-3">
      <dt className="text-[#92929b]">{label}</dt>
      <dd className="break-all text-right text-[#e4e4e7]">{value}</dd>
    </div>
  );
}
