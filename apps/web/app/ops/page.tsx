import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function OperationsHome() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-[14px] text-zinc-500 hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Customer workspace
      </Link>
      <Badge
        variant="neutral"
        className="mt-10 block w-fit"
      >
        Protected operator area
      </Badge>
      <h1 className="mt-5 text-5xl tracking-[-.06em]">Operations control plane</h1>
      <Card className="mt-8 p-8">
        <LockKeyhole className="size-5 text-violet-300" />
        <h2 className="mt-5 text-lg">No live controls yet</h2>
        <p className="mt-2 max-w-xl text-[15px] leading-6 text-zinc-500">
          This route is role-protected. Procurement approvals, treasury reconciliation, policy
          controls, and audited remediation will be added only with their deterministic backend
          commands.
        </p>
      </Card>
    </main>
  );
}
