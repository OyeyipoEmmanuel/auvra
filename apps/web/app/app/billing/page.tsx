import Link from "next/link";
import { ArrowUpRight, ReceiptText } from "lucide-react";

import { StateDot, WorkspaceEmpty, WorkspaceHeader, formatMoney } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function BillingPage() {
  const user = await requirePageUser();
  const payments = await prisma.customerPayment.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      provider: true,
      state: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
      projectId: true,
      verifiedAt: true,
      reconciledAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Billing"
        description="Your recorded project payments. Sandbox entries are not real charges or receipts."
      />
      <div className="mt-8 overflow-hidden rounded-xl border border-[var(--ws-border)]">
        {payments.length === 0 ? (
          <WorkspaceEmpty
            title="No payments yet"
            description="A payment record will appear after you accept a quote and enter checkout."
            href="/app/requests"
            action="View requests"
          />
        ) : (
          payments.map((payment) => {
            const sandbox = payment.provider !== "BACHS";
            return (
              <Link
                key={payment.id}
                href={`/app/billing/${payment.id}`}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ws-border)] px-5 py-5 transition-colors last:border-0 hover:bg-[var(--ws-surface)]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-300">
                    <ReceiptText
                      className="size-5"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-[15px] font-medium text-white">
                      {sandbox ? "Sandbox payment" : "Bachs payment"}
                      <span className="ml-2 text-[13px] font-normal text-[#85858e]">
                        {payment.id.slice(0, 8).toUpperCase()}
                      </span>
                    </p>
                    <p className="mt-1 text-[13px] text-[#92929b]">
                      {payment.createdAt.toLocaleDateString()} ·{" "}
                      {sandbox
                        ? "Simulated only"
                        : payment.reconciledAt
                          ? "Reconciled"
                          : payment.verifiedAt
                            ? "Verified charge; settlement pending"
                            : "Not verified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StateDot state={payment.state} />
                  <span className="text-[15px] font-semibold text-white">
                    {formatMoney(payment.amountMinor, payment.currency)}
                  </span>
                  <ArrowUpRight
                    className="size-4 text-[#85858e]"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
