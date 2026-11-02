import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FlaskConical, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, customerId: user.id },
    include: {
      request: { select: { id: true, rawBrief: true } },
      tasks: { orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, provider: true, state: true, currency: true, amountMinor: true, allocatedAt: true } },
    },
  });
  if (!project) notFound();
  const demoPayment = project.payments.find((payment) => payment.provider === "DEMO_SANDBOX");

  return <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><Link href="/app" className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white"><ArrowLeft className="size-3.5" />Back to workspace</Link><div className="mt-8 flex flex-wrap items-center gap-3"><Badge variant="warning">Development sandbox</Badge><Badge variant="neutral">{project.state}</Badge></div><h1 className="mt-5 text-4xl tracking-[-.055em] sm:text-5xl">Project plan created.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">{project.request.rawBrief}</p>
    <Card className="mt-8 border-amber-300/20 p-6 sm:p-8"><div className="flex items-start gap-4"><FlaskConical className="mt-1 size-5 shrink-0 text-amber-200" /><div><h2 className="text-lg font-medium">Simulated funding recorded</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{demoPayment ? `${formatMinor(demoPayment.amountMinor, demoPayment.currency)} of demo funds were allocated on ${demoPayment.allocatedAt?.toLocaleString() ?? "the project creation date"}.` : "The demo payment record is unavailable."} No wallet transfer or marketplace hire occurred.</p><p className="mt-3 text-xs text-zinc-600">The supplier budget is reserved in Auvra’s demo ledger. It is not real cash, revenue, or marketplace escrow.</p></div></div></Card>
    <div className="mt-8 flex items-center justify-between"><div><h2 className="text-xl font-medium">Planned tasks</h2><p className="mt-1 text-xs text-zinc-600">Execution is paused until the supplier procurement system is built and authorized.</p></div><Badge variant="neutral">{project.tasks.length} tasks</Badge></div><div className="mt-5 space-y-3">{project.tasks.map((task, index) => <Card key={task.id} className="p-5 sm:p-6"><div className="flex items-start gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 font-mono text-xs text-violet-300">0{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-medium">{task.title}</h3><Badge variant="neutral">{task.status}</Badge></div><p className="mt-2 text-xs leading-6 text-zinc-500">{task.objective}</p><p className="mt-3 text-xs text-zinc-600">Observed supplier cost: {formatMinor(task.budgetMinor, task.budgetCurrency)}</p></div></div></Card>)}</div><Card className="mt-7 p-6"><div className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-medium">Procurement guard</p><p className="mt-2 text-xs leading-6 text-zinc-500">Project creation does not authorize a real supplier purchase. Auvra must verify marketplace funding, supplier availability, spend limits, and a separate execution approval.</p></div></div></Card><Link href={`/app/requests/${project.request.id}`} className="mt-6 inline-flex items-center gap-2 text-xs text-violet-300 hover:text-violet-200"><CheckCircle2 className="size-4" />Review original request and quote</Link></main>;
}

function formatMinor(minor: bigint, currency: string) {
  const value = minor.toString().padStart(3, "0");
  return `${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}
