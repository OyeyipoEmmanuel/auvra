import { Check, Circle, LockKeyhole } from "lucide-react";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-medium uppercase tracking-[.14em] text-[#a682f1]">{children}</p>
  );
}

export function OperationsPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#34343a] bg-[#141416]">
      <div className="flex items-center justify-between gap-4 border-b border-[#2b2b30] px-5 py-4">
        <div>
          <p className="text-[14px] font-semibold">Project workflow</p>
          <p className="mt-1 text-[13px] text-[#777780]">Illustrative operations view</p>
        </div>
        <span className="rounded-md border border-[#38383e] px-2 py-1 text-[12px] text-[#a1a1aa]">
          Planning
        </span>
      </div>
      <div className="grid sm:grid-cols-[minmax(0,1fr)_205px]">
        <div className="px-5 py-5 sm:px-6">
          <p className="text-[13px] text-[#777780]">PROJECT / LAUNCH WEBSITE</p>
          <h3 className="mt-2 text-lg font-medium tracking-[-.03em]">
            A clear path from brief to delivery
          </h3>
          <div className="mt-6 border-t border-[#2b2b30]">
            <OperationRow
              index="01"
              title="Define the scope"
              state="Complete"
              done
            />
            <OperationRow
              index="02"
              title="Review supplier coverage"
              state="In review"
              active
            />
            <OperationRow
              index="03"
              title="Customer approves quote"
              state="Waiting"
            />
            <OperationRow
              index="04"
              title="Execute and check work"
              state="Guarded"
            />
          </div>
        </div>
        <div className="border-t border-[#2b2b30] bg-[#101012] p-5 sm:border-l sm:border-t-0">
          <p className="text-[12px] font-semibold uppercase tracking-[.12em] text-[#8b8b95]">
            Control plane
          </p>
          <div className="mt-5 space-y-5 text-[14px]">
            <div>
              <p className="text-[#e2e2e5]">Dependencies</p>
              <p className="mt-1 leading-5 text-[#8b8b95]">
                Tasks unlock only when their prerequisites pass.
              </p>
            </div>
            <div>
              <p className="text-[#e2e2e5]">Spend approval</p>
              <p className="mt-1 leading-5 text-[#8b8b95]">
                Funding and limits are checked before procurement.
              </p>
            </div>
            <div>
              <p className="text-[#e2e2e5]">Exceptions</p>
              <p className="mt-1 leading-5 text-[#8b8b95]">
                Blocked work remains visible for review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function OperationRow({
  index,
  title,
  state,
  done = false,
  active = false,
}: {
  index: string;
  title: string;
  state: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#2b2b30] py-3.5 last:border-0">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-md border text-[12px] ${done ? "border-[#395144] bg-[#1b2920] text-[#8bcda4]" : active ? "border-[#5c4478] bg-[#251d31] text-[#c8adff]" : "border-[#38383e] text-[#777780]"}`}
      >
        {done ? <Check className="size-3" /> : index}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-[#dedee2]">{title}</span>
      <span className="text-[12px] text-[#84848e]">{state}</span>
    </div>
  );
}

export function ProcurementPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#34343a] bg-[#141416]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2b2b30] px-5 py-4">
        <div>
          <p className="text-[14px] font-semibold">Supplier evaluation</p>
          <p className="mt-1 text-[13px] text-[#777780]">NEAR Agent Market / read-only discovery</p>
        </div>
        <span className="rounded-md border border-[#52416b] bg-[#211a2a] px-2 py-1 text-[12px] text-[#c4a9f3]">
          Selection pending
        </span>
      </div>
      <div className="px-5 py-6 sm:px-6">
        <p className="text-[12px] font-medium uppercase tracking-[.12em] text-[#85858e]">
          Task requirement
        </p>
        <p className="mt-2 text-lg font-medium tracking-[-.03em]">
          Develop a responsive landing page
        </p>
        <div className="mt-6 border-t border-[#2b2b30]">
          <EvaluationRow
            label="Capability fit"
            value="Check first"
          />
          <EvaluationRow
            label="Published terms"
            value="Observe"
          />
          <EvaluationRow
            label="Availability"
            value="Verify"
          />
          <EvaluationRow
            label="Approved budget"
            value="Enforce"
          />
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-[#35313b] bg-[#1c1822] p-3 text-[13px] leading-5 text-[#aaa0b5]">
          <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />A match is not a reservation. The
          customer sees a quote before Auvra can spend.
        </div>
      </div>
    </div>
  );
}
function EvaluationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#2b2b30] py-3.5 text-[14px]">
      <span className="text-[#c8c8cf]">{label}</span>
      <span className="inline-flex items-center gap-2 text-[#90909b]">
        <Circle className="size-2 text-[#aa86f2]" />
        {value}
      </span>
    </div>
  );
}

export function TreasuryPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#34343a] bg-[#141416]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2b2b30] px-5 py-4">
        <div>
          <p className="text-[14px] font-semibold">Project accounting</p>
          <p className="mt-1 text-[13px] text-[#777780]">A record for every movement of value</p>
        </div>
        <span className="text-[12px] text-[#777780]">
          Illustrative structure · no live balances
        </span>
      </div>
      <div className="grid gap-px bg-[#2b2b30] sm:grid-cols-4">
        <FinanceStage
          title="Customer funding"
          subtitle="Verified payment"
        />
        <FinanceStage
          title="Project reserve"
          subtitle="Committed capacity"
        />
        <FinanceStage
          title="Supplier expense"
          subtitle="Settled cost"
        />
        <FinanceStage
          title="Contribution"
          subtitle="Recognized after close"
        />
      </div>
      <div className="px-5 py-3 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_110px_65px] gap-3 border-b border-[#2b2b30] py-2 text-[12px] text-[#777780]">
          <span>Ledger event</span>
          <span>Status</span>
          <span className="text-right">Amount</span>
        </div>
        <FinanceRow
          title="Customer quote"
          status="Presented"
        />
        <FinanceRow
          title="Customer payment"
          status="Pending"
        />
        <FinanceRow
          title="Supplier commitment"
          status="Not posted"
        />
        <FinanceRow
          title="Realized profit"
          status="Not recognized"
        />
      </div>
    </div>
  );
}
function FinanceStage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-[#141416] p-4 sm:p-5">
      <p className="text-[14px] font-medium text-[#e4e4e7]">{title}</p>
      <p className="mt-2 text-[12px] text-[#85858e]">{subtitle}</p>
    </div>
  );
}
function FinanceRow({ title, status }: { title: string; status: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px_65px] gap-3 border-b border-[#252529] py-3 text-[14px] last:border-0">
      <span className="text-[#dedee2]">{title}</span>
      <span className="text-[#85858e]">{status}</span>
      <span className="text-right text-[#85858e]">—</span>
    </div>
  );
}
export function AboutRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid gap-2 border-b border-[#303035] py-5 sm:grid-cols-[185px_1fr] sm:gap-6">
      <h3 className="text-[15px] font-medium text-[#e8e8eb]">{title}</h3>
      <p className="text-[14px] leading-6 text-[#8f8f99]">{detail}</p>
    </div>
  );
}
