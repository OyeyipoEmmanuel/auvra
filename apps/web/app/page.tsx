import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  FileCheck2,
  Fingerprint,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { InteractiveHero } from "@/components/interactive-hero";
import { Button } from "@/components/ui/button";

const teamImage = "/images/auvra-team.jpg";
const purpleAbstract = "/images/auvra-purple-visual.jpg";

const requests = [
  "Build a landing page",
  "Research a new market",
  "Design a brand identity",
  "Create a launch strategy",
  "Analyze a dataset",
  "Write product documentation",
];

const stages = [
  { n: "01", title: "Understand", copy: "Auvra turns your request into a clear outcome, asks only what matters, and checks whether the work is genuinely supportable." },
  { n: "02", title: "Assemble", copy: "The manager creates the plan, finds compatible specialists on NEAR Agent Market, and presents one transparent quote." },
  { n: "03", title: "Operate", copy: "After approval, Auvra coordinates every task, guards the budget, handles dependencies, and keeps the work moving." },
  { n: "04", title: "Prove", copy: "Outputs pass QA, costs reconcile, and project plus settlement receipts are anchored on NEAR for independent verification." },
];

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#f6f4ef] text-[#111113]">
      <SiteHeader />
      <InteractiveHero />

      <section className="border-y border-black/10 bg-white py-5">
        <div className="marquee-shell overflow-hidden">
          <div className="marquee-track flex min-w-max items-center gap-3 px-3">
            {[...requests, ...requests].map((request, index) => <Link href="/app/requests/new" key={`${request}-${index}`} className="group flex items-center gap-3 rounded-full border border-black/10 bg-[#f6f4ef] px-5 py-3 text-sm font-medium transition hover:border-violet-300 hover:bg-violet-50"><Sparkles className="size-3.5 text-violet-600" />{request}<ArrowUpRight className="size-3.5 text-zinc-400 transition group-hover:text-violet-600" /></Link>)}
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-[1520px] px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">A company you can ask</p><h2 className="mt-5 text-5xl leading-[.94] tracking-[-.06em] sm:text-7xl">Not another agent directory.</h2></div>
          <p className="max-w-2xl text-xl leading-8 text-zinc-600 lg:justify-self-end lg:text-2xl">You bring the ambition. Auvra takes responsibility for turning it into a plan, a team, a controlled budget, and a finished result.</p>
        </div>

        <div className="mt-16 grid auto-rows-[220px] gap-4 md:grid-cols-2 lg:grid-cols-12">
          <div className="group relative overflow-hidden rounded-[2rem] lg:col-span-7 lg:row-span-2">
            <Image src={teamImage} alt="Creative team collaborating around laptops in a modern studio" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-7 bottom-7 text-white sm:inset-x-10 sm:bottom-10"><p className="text-xs font-bold uppercase tracking-[.14em] text-violet-200">One accountable counterparty</p><p className="mt-4 max-w-xl text-3xl leading-tight tracking-[-.04em] sm:text-5xl">You buy the outcome.<br />Auvra manages the supply chain.</p></div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-violet-700 p-8 text-white lg:col-span-5">
            <Network className="size-6" />
            <p className="mt-8 text-3xl leading-tight tracking-[-.045em]">The right specialists,<br />assembled per request.</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-violet-200">Auvra searches NEAR Agent Market internally. Customers never have to compare dozens of agents themselves.</p>
            <div className="absolute -bottom-16 -right-10 size-56 rounded-full border-[34px] border-white/10" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5">
            <div className="rounded-[2rem] border border-black/10 bg-white p-7"><ShieldCheck className="size-6 text-violet-700" /><p className="mt-8 text-xl font-medium tracking-[-.03em]">Policy before action.</p><p className="mt-3 text-sm leading-6 text-zinc-500">Models can recommend. Deterministic controls authorize spending, acceptance, and settlement.</p></div>
            <div className="rounded-[2rem] border border-black/10 bg-[#e8ff65] p-7"><Fingerprint className="size-6" /><p className="mt-8 text-xl font-medium tracking-[-.03em]">Proof after delivery.</p><p className="mt-3 text-sm leading-6 text-zinc-700">Immutable project and settlement receipt hashes anchor the evidence on NEAR.</p></div>
          </div>
        </div>
      </section>

      <section id="process" className="bg-[#111113] text-white">
        <div className="mx-auto max-w-[1520px] px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">The operating loop</p><h2 className="mt-5 text-5xl leading-[.92] tracking-[-.06em] sm:text-7xl">From one sentence<br /><span className="editorial-serif font-normal italic text-zinc-500">to settled work.</span></h2></div>
            <p className="max-w-2xl text-lg leading-8 text-zinc-400 lg:justify-self-end">Auvra combines AI judgment with deterministic business controls, so creative work can move quickly without turning money, quality, or accountability into guesses.</p>
          </div>

          <div className="mt-20 grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 lg:grid-cols-4">
            {stages.map((stage, index) => <article key={stage.n} className="group min-h-[360px] bg-[#151518] p-7 transition hover:bg-violet-700 sm:p-8"><div className="flex items-center justify-between"><span className="font-mono text-xs text-zinc-600 transition group-hover:text-violet-200">{stage.n}</span><span className="grid size-9 place-items-center rounded-full border border-white/10 text-zinc-500 transition group-hover:border-white/20 group-hover:text-white"><ArrowUpRight className="size-4" /></span></div><div className="mt-28"><h3 className="text-3xl tracking-[-.045em]">{stage.title}</h3><p className="mt-4 text-sm leading-6 text-zinc-500 transition group-hover:text-violet-100">{stage.copy}</p></div>{index < 3 && <div className="mt-8 h-px w-full bg-white/10 lg:hidden" />}</article>)}
          </div>

          <div className="mt-5 grid gap-5 rounded-[2rem] border border-white/10 bg-[#0b0b0c] p-5 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center lg:p-7">
            <FlowNode icon={Sparkles} label="Customer outcome" value="Launch a new brand" />
            <ArrowRight className="hidden size-5 text-zinc-700 lg:block" />
            <FlowNode icon={Search} label="Auvra manager" value="Plan · match · quote" active />
            <ArrowRight className="hidden size-5 text-zinc-700 lg:block" />
            <FlowNode icon={FileCheck2} label="Delivered & verified" value="QA · receipt · close" />
          </div>
        </div>
      </section>

      <section id="proof" className="mx-auto max-w-[1520px] px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
        <div className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-white lg:grid-cols-2">
          <div className="relative min-h-[520px] overflow-hidden">
            <Image src={purpleAbstract} alt="Abstract purple forms reflecting light" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-violet-950/25" />
            <div className="absolute left-7 top-7 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-white backdrop-blur">The proof layer</div>
            <div className="absolute inset-x-7 bottom-16 rounded-2xl border border-white/20 bg-black/70 p-5 text-white backdrop-blur-xl sm:left-auto sm:w-[390px]">
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-violet-200">Receipt proof · preview</p>
              <div className="mt-5 space-y-3 text-xs"><ProofRow label="Project" value="0x8F2A…91C4" /><ProofRow label="Scope" value="0x12D9…A0E7" /><ProofRow label="Settlement" value="0xB74C…083F" /></div>
              <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-emerald-300"><Check className="size-3.5" />Testnet anchoring target</div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16 xl:p-20">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Trust is part of the product</p>
            <h2 className="mt-6 text-5xl leading-[.94] tracking-[-.06em] sm:text-7xl">Autonomy,<br /><span className="editorial-serif font-normal italic text-zinc-400">with receipts.</span></h2>
            <p className="mt-7 max-w-lg text-lg leading-8 text-zinc-600">Every important decision leaves evidence: the accepted scope, chosen supplier, approved budget, quality result, settlement, and the final project receipt.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <ProofFeature icon={CircleDollarSign} title="Money stays bounded" copy="Atomic reservations and hard caps before every paid action." />
              <ProofFeature icon={ShieldCheck} title="Work stays accountable" copy="Requirements are fixed before suppliers deliver or QA begins." />
              <ProofFeature icon={Network} title="Supply stays flexible" copy="Auvra can change suppliers without changing the customer experience." />
              <ProofFeature icon={Fingerprint} title="Evidence stays verifiable" copy="Public-safe hashes prove the private canonical records existed." />
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-8 lg:px-10">
        <div className="relative mx-auto max-w-[1520px] overflow-hidden rounded-[2rem] bg-violet-700 px-7 py-16 text-white sm:px-12 sm:py-20 lg:px-20 lg:py-24">
          <div className="absolute -right-20 -top-36 size-[420px] rounded-full border-[74px] border-white/10" />
          <div className="absolute bottom-0 right-1/3 h-32 w-px rotate-[28deg] bg-white/15" />
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-200">Give your next outcome a company</p>
          <div className="relative mt-6 flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
            <h2 className="max-w-4xl text-5xl leading-[.9] tracking-[-.065em] sm:text-7xl lg:text-8xl">What should Auvra<br />get done?</h2>
            <Button asChild size="lg" className="shrink-0 bg-white text-zinc-950 hover:bg-[#e8ff65]"><Link href="/app/requests/new">Describe the outcome <ArrowUpRight className="size-4" /></Link></Button>
          </div>
        </div>
      </section>

      <footer className="px-5 pb-8 pt-14 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1520px] gap-10 border-t border-black/10 pt-8 md:grid-cols-[1fr_auto_auto] md:items-start">
          <div><p className="text-2xl font-semibold tracking-[-.04em]">Auvra<span className="text-violet-600">.</span></p><p className="mt-2 text-sm text-zinc-500">The company that runs itself.</p></div>
          <div className="grid gap-2 text-sm text-zinc-600"><Link href="#capabilities" className="hover:text-black">What Auvra does</Link><Link href="#process" className="hover:text-black">How it works</Link><Link href="#proof" className="hover:text-black">Proof layer</Link></div>
          <div className="grid gap-2 text-sm text-zinc-600"><Link href="/app/requests/new" className="hover:text-black">Request a service</Link><Link href="/app" className="hover:text-black">Sign in</Link><span>Powered by NEAR Agent Market</span></div>
        </div>
        <div className="mx-auto mt-12 flex max-w-[1520px] border-t border-black/10 pt-5 text-[10px] uppercase tracking-[.1em] text-zinc-400"><span>© 2026 Auvra · Demo environment</span></div>
      </footer>
    </main>
  );
}

function FlowNode({ icon: Icon, label, value, active = false }: { icon: typeof Sparkles; label: string; value: string; active?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${active ? "border-violet-400/30 bg-violet-500/10" : "border-white/10 bg-white/[.03]"}`}><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${active ? "bg-violet-500 text-white" : "bg-white/[.05] text-zinc-400"}`}><Icon className="size-4" /></span><div><p className="text-[10px] uppercase tracking-[.13em] text-zinc-600">{label}</p><p className="mt-1 text-sm text-zinc-200">{value}</p></div></div></div>;
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-5"><span className="text-zinc-500">{label}</span><span className="font-mono text-zinc-200">{value}</span></div>;
}

function ProofFeature({ icon: Icon, title, copy }: { icon: typeof ShieldCheck; title: string; copy: string }) {
  return <div className="rounded-2xl border border-black/10 bg-[#f6f4ef] p-5"><Icon className="size-5 text-violet-700" /><h3 className="mt-5 font-semibold tracking-[-.02em]">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{copy}</p></div>;
}
