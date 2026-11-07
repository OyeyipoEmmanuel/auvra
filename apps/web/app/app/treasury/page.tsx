import Link from "next/link";

import { StateDot, WorkspaceEmpty, WorkspaceHeader, formatMoney } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function TreasuryPage() {
  const user = await requirePageUser();
  const payments = await prisma.customerPayment.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      state: true,
      provider: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
      projectId: true,
    },
  });
  const live = payments.filter((payment) => payment.provider === "BACHS");
  const demo = payments.filter((payment) =>
    ["DEMO_SANDBOX", "BACHS_SANDBOX"].includes(payment.provider),
  );
  const collected = live.filter((payment) =>
    ["VERIFIED", "ALLOCATED", "RECONCILED"].includes(payment.state),
  );
  const collectedByCurrency = Object.entries(
    Object.groupBy(collected, (payment) => payment.currency),
  ).map(([currency, rows]) =>
    formatMoney(
      (rows ?? []).reduce((sum, row) => sum + row.amountMinor, BigInt(0)),
      currency,
    ),
  );
  const jobs = await prisma.supplierJob.findMany({
    where: { project: { customerId: user.id } },
    select: { committedMinor: true, settledMinor: true, currency: true },
  });
  const committedByCurrency = Object.entries(
    Object.groupBy(
      jobs.filter((job) => job.committedMinor > job.settledMinor),
      (job) => job.currency,
    ),
  ).map(([currency, rows]) =>
    formatMoney(
      (rows ?? []).reduce((sum, row) => sum + row.committedMinor - row.settledMinor, BigInt(0)),
      currency,
    ),
  );
  const settledByCurrency = Object.entries(
    Object.groupBy(
      jobs.filter((job) => job.settledMinor > BigInt(0)),
      (job) => job.currency,
    ),
  ).map(([currency, rows]) =>
    formatMoney(
      (rows ?? []).reduce((sum, row) => sum + row.settledMinor, BigInt(0)),
      currency,
    ),
  );
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Treasury"
        description="Customer payments and supplier commitments recorded for your projects."
      />
      <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--ws-border)] bg-[var(--ws-border)] md:grid-cols-3">
        <TreasuryMetric
          label="Verified payments"
          value={collectedByCurrency.join(" · ") || "—"}
          detail="Excludes sandbox entries"
        />
        <TreasuryMetric
          label="Reserved funds"
          value="—"
          detail="Awaiting treasury reconciliation"
        />
        <TreasuryMetric
          label="Supplier commitments"
          value={committedByCurrency.join(" · ") || "—"}
          detail="Unsettled, recorded jobs"
        />
        <TreasuryMetric
          label="Paid to suppliers"
          value={settledByCurrency.join(" · ") || "—"}
          detail="Settled job costs"
        />
        <TreasuryMetric
          label="Available funds"
          value="—"
          detail="No verified balance integration"
        />
        <TreasuryMetric
          label="Gross profit"
          value="—"
          detail="Available after reconciliation"
        />
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="transactions-title">
          <h2
            id="transactions-title"
            className="text-[15px] font-semibold"
          >
            Customer payments
          </h2>
          <p className="mt-1 text-[14px] text-[#85858e]">
            Provider records, not a wallet balance or bank statement
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_130px_100px] gap-3 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-4 py-3 text-[13px] text-[#777780] sm:grid">
              <span>Provider</span>
              <span>Status</span>
              <span>Amount</span>
              <span className="text-right">Date</span>
            </div>
            {payments.length ? (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-2 border-b border-[var(--ws-border)] px-4 py-3.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_110px_130px_100px] sm:items-center sm:gap-3"
                >
                  <div>
                    <p className="text-[14px] font-medium text-[#e4e4e7]">
                      {payment.provider === "DEMO_SANDBOX"
                        ? "Demo funding"
                        : payment.provider === "BACHS_SANDBOX"
                          ? "Bachs sandbox"
                          : payment.provider}
                    </p>
                    <p className="mt-1 text-[13px] text-[#777780]">
                      {payment.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <StateDot state={payment.state} />
                  <span className="text-[14px] text-[#d4d4d8]">
                    {formatMoney(payment.amountMinor, payment.currency)}
                  </span>
                  <span className="text-[14px] text-[#777780] sm:text-right">
                    {payment.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <WorkspaceEmpty
                title="No payment records"
                description="Accepted quotes and completed funding steps will appear here."
                href="/app/requests"
                action="View requests"
              />
            )}
          </div>
        </section>
        <aside className="space-y-5">
          <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)] p-5">
            <p className="text-[14px] font-semibold text-[#e4e4e7]">Development sandbox</p>
            <p className="mt-2 text-[14px] leading-5 text-[#92929b]">
              {demo.length} simulated payment{demo.length === 1 ? "" : "s"} recorded. Demo USDC is
              not a transferable token or realized revenue.
            </p>
          </div>
          <div className="border-t border-[var(--ws-border)] pt-5">
            <p className="text-[14px] font-semibold text-[#e4e4e7]">Available funds and profit</p>
            <p className="mt-2 text-[14px] leading-5 text-[#92929b]">
              These require verified treasury balances and settled ledger reconciliation. Auvra does
              not yet calculate them from demo allocations.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function TreasuryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 bg-[var(--ws-surface)] p-4 sm:p-5">
      <p className="text-[13px] text-[#92929b]">{label}</p>
      <p className="mt-3 break-words text-xl font-semibold tracking-[-.035em]">{value}</p>
      <p className="mt-1 text-[13px] text-[#696971]">{detail}</p>
    </div>
  );
}
