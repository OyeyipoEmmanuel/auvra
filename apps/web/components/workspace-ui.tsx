import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";

export function WorkspaceHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--ws-border)] pb-7 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-5 text-[var(--ws-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function WorkspaceEmpty({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-6 py-10 text-center">
      <Inbox
        className="mb-4 size-5 text-[#6f6f78]"
        strokeWidth={1.6}
      />
      <p className="text-[15px] font-medium text-[#e4e4e7]">{title}</p>
      <p className="mt-1 max-w-md text-[14px] leading-5 text-[var(--ws-muted)]">{description}</p>
      {href && action && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-[#b8a1fa] hover:text-white"
        >
          {action}
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

export function StateDot({ state }: { state: string }) {
  const color = /FAILED|REJECTED|UNSUPPORTED|DISPUTED|CANCELLED/.test(state)
    ? "bg-rose-400"
    : /QUOTED|NEEDS_CLARIFICATION|PENDING|APPROVED|AWAITING/.test(state)
      ? "bg-amber-400"
      : /DELIVERED|CLOSED|ACCEPTED|VERIFIED|RECONCILED/.test(state)
        ? "bg-emerald-400"
        : "bg-[#888891]";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[14px] text-[#a1a1aa]">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${color}`}
      />
      {humanState(state)}
    </span>
  );
}

export function humanState(state: string) {
  return state
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatMoney(minor: bigint, currency: string) {
  const sign = minor < BigInt(0) ? "-" : "";
  const value = (minor < BigInt(0) ? -minor : minor).toString().padStart(3, "0");
  return `${sign}${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}
