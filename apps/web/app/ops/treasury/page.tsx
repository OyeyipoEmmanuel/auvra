import Link from "next/link";

import { formatMoney } from "@/components/workspace-ui";
import { prisma } from "@/lib/prisma";

export default async function OperatorTreasuryPage() {
  const [payments, jobs, journals] = await Promise.all([
    prisma.customerPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        provider: true,
        state: true,
        currency: true,
        amountMinor: true,
        createdAt: true,
      },
    }),
    prisma.supplierJob.findMany({ select: { committedMinor: true, settledMinor: true } }),
    prisma.ledgerTransaction.findMany({
      orderBy: { postedAt: "desc" },
      take: 50,
      include: { entries: { select: { side: true, amountMinor: true } } },
    }),
  ]);
  const unsettled = jobs.filter((job) => job.committedMinor > job.settledMinor).length;
  const unbalanced = journals.filter((journal) => {
    const debits = journal.entries
      .filter((entry) => entry.side === "DEBIT")
      .reduce((sum, entry) => sum + entry.amountMinor, BigInt(0));
    const credits = journal.entries
      .filter((entry) => entry.side === "CREDIT")
      .reduce((sum, entry) => sum + entry.amountMinor, BigInt(0));
    return debits !== credits;
  }).length;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/ops"
        className="text-[14px] text-zinc-400 hover:text-white"
      >
        ← Operations
      </Link>
      <h1 className="mt-7 text-3xl font-semibold tracking-tight">Treasury evidence</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-6 text-zinc-400">
        Internal records, not a bank or marketplace balance. Sandbox payments are not live
        collection.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Live Bachs records"
          value={payments.filter((payment) => payment.provider === "BACHS").length}
        />
        <Metric
          label="Unsettled supplier jobs"
          value={unsettled}
        />
        <Metric
          label="Unbalanced recent journals"
          value={unbalanced}
        />
      </div>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent payment records</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {payments.length ? (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="grid gap-2 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0 sm:grid-cols-[1fr_120px_120px_120px]"
              >
                <div>
                  <p className="font-medium">
                    {payment.provider}{" "}
                    <span className="text-zinc-500">{payment.id.slice(0, 8)}</span>
                  </p>
                  <p className="mt-1 text-zinc-500">{payment.createdAt.toLocaleString()}</p>
                </div>
                <span>{payment.state}</span>
                <span>{formatMoney(payment.amountMinor, payment.currency)}</span>
                <span
                  className={payment.provider === "BACHS" ? "text-emerald-300" : "text-amber-300"}
                >
                  {payment.provider === "BACHS" ? "Live rail" : "Sandbox"}
                </span>
              </div>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No payment records.</p>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent journals</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {journals.length ? (
            journals.map((journal) => (
              <div
                key={journal.id}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0"
              >
                <span>
                  {journal.transactionType} · {journal.id.slice(0, 8)}
                </span>
                <span className="text-zinc-400">
                  {journal.asset} · {journal.entries.length} entries
                </span>
              </div>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No journals.</p>
          )}
        </div>
      </section>
      <p className="mt-7 text-[14px] text-amber-200">
        Realized profit remains unavailable until provider settlement and ledger evidence agree.
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-[14px] text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
