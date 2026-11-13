import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Download, FileCheck2, ShieldCheck } from "lucide-react";

import { formatMoney } from "@/components/workspace-ui";
import { VerifyProjectReceipt } from "@/components/verify-project-receipt";
import { requirePageUser } from "@/lib/authz";
import { getNoChargeProjectReceipt, localNoChargeProof } from "@/lib/project-receipt";

export default async function ProjectReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const receipt = await getNoChargeProjectReceipt(id, user.id);
  if (!receipt) notFound();

  const { project, payment, anchor } = receipt;
  const localProof = localNoChargeProof(receipt);
  const verified =
    anchor?.state === "CONFIRMED" &&
    Boolean(anchor.contractAccount) &&
    localProof?.canonicalRecordHash === anchor.canonicalRecordHash;
  const explorer =
    verified && anchor.transactionHash
      ? `https://testnet.nearblocks.io/txns/${encodeURIComponent(anchor.transactionHash)}`
      : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
      <Link
        href={`/app/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-[14px] text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back to project
      </Link>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)]">
        <div className="border-b border-[var(--ws-border)] bg-[radial-gradient(circle_at_top_right,rgba(112,68,199,.16),transparent_45%)] p-6 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200">
                <FileCheck2 className="size-5" />
              </span>
              <p className="mt-5 text-[13px] font-medium uppercase tracking-[.14em] text-violet-300">
                Project record
              </p>
              <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-white sm:text-[36px]">
                Your project receipt
              </h1>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-zinc-400">
                A record of the approved project and its quoted scope.
              </p>
            </div>
            <a
              href={`/api/projects/${project.id}/receipt`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-[14px] text-zinc-200 hover:border-violet-300/40 hover:text-white"
            >
              <Download className="size-4" /> Download receipt
            </a>
          </div>
        </div>

        <div className="space-y-8 p-6 sm:p-9">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail
              label="Reference"
              value={project.id.slice(0, 8).toUpperCase()}
            />
            <Detail
              label="Created"
              value={payment.createdAt.toLocaleString()}
            />
            <Detail
              label="Quoted project value"
              value={formatMoney(payment.quote.customerTotalMinor, payment.quote.currency)}
            />
            <Detail
              label="Amount charged"
              value={`${payment.quote.currency} 0.00`}
            />
          </dl>

          <div className="border-t border-[var(--ws-border)] pt-7">
            <div className="flex items-start gap-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${verified ? "bg-emerald-400/10 text-emerald-300" : "bg-violet-400/10 text-violet-300"}`}
              >
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h2 className="text-[17px] font-medium text-white">
                  {verified ? "Verified on NEAR testnet" : "Onchain verification pending"}
                </h2>
                <p className="mt-1 text-[14px] leading-6 text-zinc-400">
                  {verified
                    ? "The project record hash matches the receipt stored by the NEAR testnet contract."
                    : "The project receipt is available now. Its record hash will be checked against NEAR testnet when the contract transaction is confirmed."}
                </p>
              </div>
            </div>
            {(anchor || localProof) && (
              <dl className="mt-5 space-y-3 rounded-xl border border-white/[.07] bg-black/10 p-4 text-[13px]">
                <HashDetail
                  label="Record hash"
                  value={anchor?.canonicalRecordHash ?? localProof!.canonicalRecordHash}
                />
                <HashDetail
                  label="Reference hash"
                  value={anchor?.referenceHash ?? localProof!.referenceHash}
                />
                {verified && anchor?.contractAccount && (
                  <HashDetail
                    label="Contract"
                    value={anchor.contractAccount}
                  />
                )}
              </dl>
            )}
            {explorer && (
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-violet-300 hover:text-white"
              >
                View on NEAR Explorer <ArrowUpRight className="size-4" />
              </a>
            )}
            {!verified && anchor && process.env.NEAR_RECEIPT_CONTRACT_ACCOUNT && (
              <VerifyProjectReceipt projectId={project.id} />
            )}
          </div>

          <p className="border-t border-[var(--ws-border)] pt-6 text-[13px] leading-5 text-zinc-500">
            This receipt confirms the project record. No customer payment or supplier settlement is
            represented by this receipt.
          </p>
        </div>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-zinc-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-medium text-zinc-100">{value}</dd>
    </div>
  );
}

function HashDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="max-w-full break-all font-mono text-zinc-300">{value}</dd>
    </div>
  );
}
