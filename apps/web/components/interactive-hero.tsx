"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Network,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const scenarios = [
  {
    label: "Launch a brand",
    prompt: "Create the brand and launch site for my sustainable clothing label.",
    tasks: "6",
    specialists: "4",
    timeline: "8–12 days",
    quote: "$1,840",
    deliverable: "Identity + launch site",
    team: ["Brand strategist", "Visual designer", "Web builder", "QA specialist"],
  },
  {
    label: "Research a market",
    prompt: "Map the Nigerian fintech market and show me the best opening.",
    tasks: "4",
    specialists: "3",
    timeline: "3–5 days",
    quote: "$680",
    deliverable: "Opportunity report",
    team: ["Market researcher", "Data analyst", "Strategy reviewer"],
  },
  {
    label: "Analyze my data",
    prompt: "Find the growth story hidden inside this customer dataset.",
    tasks: "5",
    specialists: "3",
    timeline: "2–4 days",
    quote: "$520",
    deliverable: "Analysis + dashboard",
    team: ["Data analyst", "Insight writer", "QA specialist"],
  },
];

export function InteractiveHero() {
  const [active, setActive] = useState(0);
  const scenario = scenarios[active];

  return (
    <section className="relative">
      <div className="relative min-h-[780px] overflow-hidden bg-[#0b0b0d] text-white lg:min-h-[850px]">
        <Image
          src="/images/auvra-architecture.jpg"
          alt="Sculptural white architecture forming an abstract workspace"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(7,7,9,.98)_0%,rgba(7,7,9,.91)_42%,rgba(7,7,9,.26)_76%,rgba(7,7,9,.6)_100%)]" />
        <div className="hero-grid absolute inset-0 opacity-35" />
        <div className="hero-orb absolute -right-28 -top-32 size-[430px] rounded-full bg-violet-600/60 blur-[90px]" />
        <div className="absolute -bottom-40 left-[36%] size-[420px] rounded-full bg-[#cfff47]/15 blur-[110px]" />

        <div className="relative z-10 grid min-h-[780px] gap-14 px-6 pb-7 pt-12 sm:px-10 sm:pb-10 lg:min-h-[850px] lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-14 lg:py-16 xl:px-20">
          <div className="max-w-[850px]">
            <h1 className="mt-9 max-w-[900px] text-[clamp(4rem,7.8vw,8.8rem)] font-medium leading-[.82] tracking-[-.078em]">
              One sentence in.
              <span className="editorial-serif block font-normal italic text-[#c8a8ff]">
                A company
              </span>
              starts moving.
            </h1>
            <p className="mt-8 max-w-[660px] text-base leading-7 text-white/65 sm:text-xl sm:leading-8">
              Describe the outcome—not the workflow. Auvra builds the plan, assembles specialists
              from NEAR Agent Market, controls the budget, and delivers the work.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-13 rounded-full bg-[#d9ff64] px-6 text-zinc-950 hover:bg-white"
              >
                <Link href="/app/requests/new">
                  Give Auvra a goal <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-13 rounded-full border-white/20 bg-white/[.06] px-6 text-white hover:bg-white hover:text-zinc-950"
              >
                <Link href="#process">Watch how it works</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs text-white/55">
              {["One accountable quote", "Budget controls built in", "Verifiable delivery"].map(
                (item) => (
                  <span
                    key={item}
                    className="flex items-center gap-2"
                  >
                    <Check className="size-3.5 text-[#d9ff64]" />
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="self-end lg:self-center">
            <div className="mx-auto max-w-[560px] rounded-[1.75rem] border border-white/20 bg-white/[.10] p-3 shadow-[0_35px_120px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-4">
              <div className="rounded-[1.35rem] bg-[#f8f7f3] p-5 text-zinc-950 sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-full bg-violet-700 text-white">
                      <Sparkles className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-zinc-400">
                        Auvra manager
                      </p>
                      <p className="text-sm font-semibold">Live project preview</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    Ready
                  </span>
                </div>

                <div
                  key={scenario.label}
                  className="hero-swap"
                >
                  <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">
                    Your request
                  </p>
                  <p className="mt-2 text-xl leading-snug tracking-[-.035em] sm:text-2xl">
                    “{scenario.prompt}”
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <Stat
                      icon={FileCheck2}
                      value={scenario.tasks}
                      label="tasks"
                    />
                    <Stat
                      icon={Network}
                      value={scenario.specialists}
                      label="specialists"
                    />
                    <Stat
                      icon={Clock3}
                      value={scenario.timeline}
                      label="delivery"
                      compact
                    />
                  </div>

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-zinc-400">
                        Proposed team
                      </p>
                      <p className="text-[10px] text-zinc-400">NEAR Agent Market</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scenario.team.map((member, index) => (
                        <span
                          key={member}
                          className="flex items-center gap-2 rounded-full bg-zinc-100 py-1.5 pl-1.5 pr-3 text-[11px]"
                        >
                          <span
                            className={`grid size-5 place-items-center rounded-full text-[8px] font-bold text-white ${["bg-violet-600", "bg-fuchsia-500", "bg-blue-600", "bg-zinc-700"][index]}`}
                          >
                            {index + 1}
                          </span>
                          {member}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-[#d9ff64] p-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-zinc-600">
                        {scenario.deliverable}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Scope, QA and settlement included
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-600">Estimated quote</p>
                      <p className="text-2xl font-semibold tracking-[-.04em]">{scenario.quote}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {scenarios.map((item, index) => (
                  <button
                    type="button"
                    key={item.label}
                    aria-pressed={active === index}
                    onClick={() => setActive(index)}
                    className={`rounded-xl px-2 py-3 text-[10px] font-semibold transition sm:text-xs ${active === index ? "bg-white text-zinc-950" : "bg-white/[.06] text-white/55 hover:bg-white/[.12] hover:text-white"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[9px] uppercase tracking-[.18em] text-white/35 xl:flex">
          Explore <span className="h-8 w-px bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  compact = false,
}: {
  icon: typeof CircleDollarSign;
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl bg-zinc-100 p-3">
      <Icon className="size-3.5 text-violet-700" />
      <p className={`mt-3 font-semibold tracking-[-.035em] ${compact ? "text-sm" : "text-xl"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[.1em] text-zinc-400">{label}</p>
    </div>
  );
}
