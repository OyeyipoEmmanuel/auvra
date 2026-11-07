"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  FileText,
  FolderKanban,
  LayoutGrid,
  LockKeyhole,
  Search,
} from "lucide-react";

const examples = [
  {
    label: "Website",
    title: "Launch a business website",
    brief: "Build a landing page for my business. Make it simple, clear, and easy to navigate.",
    outcome: "A responsive landing page ready for review",
    tasks: ["Define the page scope", "Match a web specialist", "Review the quote"],
    capabilities: ["Web design", "Frontend", "Quality review"],
  },
  {
    label: "Brand",
    title: "Create a visual identity",
    brief: "Design a logo and visual direction for my new clothing label.",
    outcome: "Logo concepts and a usable identity package",
    tasks: ["Clarify audience and style", "Match a design specialist", "Review the quote"],
    capabilities: ["Identity design", "Brand strategy", "Asset delivery"],
  },
  {
    label: "Research",
    title: "Understand a market",
    brief: "Research my competitors and show where my business can stand out.",
    outcome: "Evidence-led research and a decision brief",
    tasks: ["Set the research scope", "Match a research specialist", "Review the quote"],
    capabilities: ["Market research", "Source review", "Synthesis"],
  },
] as const;

export function MarketingProductDemo() {
  const [active, setActive] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 767px)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = frameRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      element.style.transform = `translate3d(0, ${Math.max(-8, Math.min(8, (progress - 0.5) * 16))}px, 0)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  const example = examples[active];
  return (
    <div ref={frameRef}>
      <div
        className="product-frame overflow-hidden rounded-xl border border-[#303035] bg-[#101012] shadow-[0_32px_110px_rgba(0,0,0,.36)]"
        aria-label="Interactive illustration of the Auvra workspace"
      >
        <div className="flex h-11 items-center justify-between border-b border-[#252529] bg-[#141416] px-4">
          <div
            className="flex gap-1.5"
            aria-hidden="true"
          >
            <span className="size-2 rounded-full bg-[#45454b]" />
            <span className="size-2 rounded-full bg-[#45454b]" />
            <span className="size-2 rounded-full bg-[#45454b]" />
          </div>
          <span className="text-[12px] font-medium text-[#8d8d96]">Auvra / Workspace</span>
          <span className="rounded border border-[#303035] px-2 py-1 text-[9px] text-[#8d8d96]">
            Interactive preview
          </span>
        </div>
        <div className="grid md:grid-cols-[178px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[#252529] bg-[#0e0e10] p-3 md:block">
            <div className="flex items-center gap-2 px-2 py-3 text-[13px] font-semibold text-white">
              <span className="grid size-6 place-items-center rounded-md bg-[var(--brand)] text-[14px]">
                A
              </span>
              Auvra
            </div>
            <div className="mt-5 space-y-1 text-[13px]">
              <DemoNav
                icon={LayoutGrid}
                label="Overview"
              />
              <DemoNav
                icon={FileText}
                label="Requests"
                active
              />
              <DemoNav
                icon={FolderKanban}
                label="Projects"
              />
            </div>
            <div className="mt-8 border-t border-[#252529] px-2 pt-4 text-[12px] leading-5 text-[#777780]">
              One workspace for every customer outcome.
            </div>
          </aside>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252529] px-5 py-3.5 sm:px-7">
              <div className="flex items-center gap-1.5 text-[12px] text-[#8d8d96]">
                Requests <ChevronRight className="size-3" />{" "}
                <span className="text-[#d8d8dc]">Scope</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#a1a1aa]">
                <span className="size-1.5 rounded-full bg-[#a27bf5]" />
                Manager active
              </span>
            </div>
            <div
              key={example.label}
              className="demo-swap grid lg:grid-cols-[minmax(0,1fr)_250px]"
            >
              <div className="min-w-0 px-5 py-6 sm:px-7 sm:py-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[.12em] text-[#9b7bef]">
                    Service request
                  </span>
                  <span className="rounded border border-[#3b343f] bg-[#211c26] px-1.5 py-0.5 text-[9px] text-[#b9a7cf]">
                    Illustrative
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-[-.04em] text-white sm:text-2xl">
                  {example.title}
                </h3>
                <p className="mt-4 rounded-lg border border-[#29292d] bg-[#171719] p-4 text-[14px] leading-5 text-[#c3c3ca]">
                  “{example.brief}”
                </p>
                <div className="mt-6 flex items-center justify-between border-b border-[#29292d] pb-3">
                  <h4 className="text-[14px] font-semibold text-[#e7e7e9]">Plan</h4>
                  <span className="text-[12px] text-[#85858e]">3 steps</span>
                </div>
                <div>
                  {example.tasks.map((task, index) => (
                    <div
                      key={task}
                      className="flex items-center gap-3 border-b border-[#252529] py-3.5 last:border-b-0"
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-md border text-[12px] ${index === 0 ? "border-[#3b5146] bg-[#19251e] text-[#82c8a2]" : index === 1 ? "border-[#564272] bg-[#241b31] text-[#c4a4ff]" : "border-[#34343a] bg-[#19191b] text-[#777780]"}`}
                      >
                        {index === 0 ? <Check className="size-3" /> : `0${index + 1}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-[#dadade]">
                        {task}
                      </span>
                      <span className="text-[12px] text-[#8d8d96]">
                        {index === 0 ? "Defined" : index === 1 ? "In review" : "Next"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="border-t border-[#252529] bg-[#141416] px-5 py-6 sm:px-7 lg:border-l lg:border-t-0 lg:px-5">
                <p className="text-[12px] font-semibold uppercase tracking-[.12em] text-[#8d8d96]">
                  Auvra manager
                </p>
                <p className="mt-3 text-[14px] font-medium leading-5 text-[#ededee]">
                  {example.outcome}
                </p>
                <div className="mt-6 border-t border-[#29292d] pt-4">
                  <p className="text-[12px] text-[#8d8d96]">Specialist capabilities</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {example.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-md border border-[#34343a] px-2 py-1 text-[12px] text-[#c0c0c7]"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-7 flex gap-2 border-t border-[#29292d] pt-4 text-[12px] leading-4 text-[#8d8d96]">
                  <LockKeyhole className="size-3 shrink-0" />
                  No supplier purchase before an approved quote and funding.
                </div>
              </aside>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#252529] bg-[#111113] px-4 py-3 sm:px-6">
          <p className="text-[12px] text-[#777780]">Explore a sample request</p>
          <div
            role="group"
            aria-label="Choose an example"
            className="flex gap-1 rounded-lg border border-[#2d2d32] bg-[#0b0b0d] p-1"
          >
            {examples.map((item, index) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={active === index}
                onClick={() => setActive(index)}
                className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${active === index ? "bg-[#292232] text-white" : "text-[#85858e] hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoNav({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof Search;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-2 ${active ? "bg-[#1c1a21] text-white" : "text-[#8d8d96]"}`}
    >
      <Icon className="size-3.5" />
      {label}
    </div>
  );
}
