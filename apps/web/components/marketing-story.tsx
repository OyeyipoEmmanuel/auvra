"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, Check, Circle } from "lucide-react";

const stages = [
  {
    eyebrow: "01 / Intake",
    title: "Describe your request",
    copy: "Tell Auvra what outcome you need in plain language. The manager asks only the questions needed for that work.",
    panel: "Customer brief",
    highlight: "Build a landing page for my business.",
    rows: ["Outcome captured", "Constraints recorded", "Clarification if needed"],
  },
  {
    eyebrow: "02 / Planning",
    title: "Auvra plans and hires",
    copy: "Auvra turns the brief into tasks, checks external specialist coverage, and presents a scope and quote before any purchasing.",
    panel: "Scope & supplier review",
    highlight: "A plan shaped around the outcome.",
    rows: ["Task breakdown", "Marketplace coverage", "Customer quote"],
  },
  {
    eyebrow: "03 / Execution",
    title: "Agents execute the work",
    copy: "After funding and authorization, specialist jobs can run under spending limits while Auvra tracks progress and exceptions.",
    panel: "Execution workflow",
    highlight: "Work moves through guarded stages.",
    rows: ["Funding verified", "Supplier job authorized", "Progress monitored"],
  },
  {
    eyebrow: "04 / Delivery",
    title: "Auvra delivers and settles",
    copy: "Outputs are checked against the agreed scope. Customer review, supplier costs, and settlement close the loop.",
    panel: "Delivery & accounting",
    highlight: "A finished outcome with a clear record.",
    rows: ["Deliverable review", "Customer acceptance", "Cost reconciliation"],
  },
] as const;

export function MarketingStory() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.stage));
      },
      { rootMargin: "-25% 0px -40% 0px", threshold: [0, 0.25, 0.5] },
    );
    refs.current.forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);
  const stage = stages[active];
  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
      <div className="border-t border-[#303035]">
        {stages.map((item, index) => (
          <button
            key={item.eyebrow}
            ref={(node) => {
              refs.current[index] = node;
            }}
            data-stage={index}
            type="button"
            aria-pressed={active === index}
            onClick={() => setActive(index)}
            className={`group w-full border-b border-[#303035] py-7 text-left transition-colors sm:py-9 ${active === index ? "text-white" : "text-[#8a8a94] hover:text-[#e4e4e7]"}`}
          >
            <div className="flex gap-5">
              <span
                className={`pt-1 text-[13px] font-medium ${active === index ? "text-[#a783f4]" : "text-[#6e6e77]"}`}
              >
                {item.eyebrow.slice(0, 2)}
              </span>
              <div>
                <p className="text-[13px] font-medium uppercase tracking-[.12em] text-[#787881]">
                  {item.eyebrow.slice(5)}
                </p>
                <h3 className="mt-2 text-[22px] font-medium tracking-[-.035em] sm:text-[26px]">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-md text-[14px] leading-6 text-[#93939d]">{item.copy}</p>
              </div>
              <ArrowDownRight
                className={`ml-auto mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${active === index ? "text-[#a783f4]" : "text-[#61616a]"}`}
              />
            </div>
          </button>
        ))}
      </div>
      <div className="auvra-story-sticky lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-[#34343a] bg-[#131315]">
          <div className="flex items-center justify-between border-b border-[#2b2b30] px-5 py-4">
            <span className="text-[14px] font-medium text-[#dedee2]">Auvra / {stage.panel}</span>
            <span className="text-[12px] text-[#8b8b95]">Preview</span>
          </div>
          <div
            key={stage.eyebrow}
            className="demo-swap p-6 sm:p-8"
          >
            <p className="text-[12px] font-medium uppercase tracking-[.14em] text-[#a783f4]">
              {stage.eyebrow}
            </p>
            <h4 className="mt-4 max-w-sm text-[24px] font-medium leading-tight tracking-[-.04em] sm:text-[28px]">
              {stage.highlight}
            </h4>
            <div className="mt-8 border-t border-[#2b2b30]">
              {stage.rows.map((row, index) => (
                <div
                  key={row}
                  className="flex items-center gap-3 border-b border-[#2b2b30] py-4 text-[14px] text-[#c9c9cf]"
                >
                  <span
                    className={`grid size-6 place-items-center rounded-md border ${index === 0 ? "border-[#465b4c] bg-[#1d2a21] text-[#8fd2a4]" : "border-[#38383e] bg-[#1c1c1e] text-[#8b8b95]"}`}
                  >
                    {index === 0 ? <Check className="size-3" /> : <Circle className="size-2" />}
                  </span>
                  {row}
                  <span className="ml-auto text-[12px] text-[#7b7b84]">
                    {index === 0 ? "Defined" : "Next"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[13px] leading-5 text-[#7e7e88]">
              Illustrative workflow. Live supplier hiring and settlement are not enabled in the
              current demo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px 12% 0px" },
    );
    if (ref.current) observer.observe(ref.current);
    setReady(true);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} ${ready ? "reveal-ready" : ""} ${visible ? "reveal-visible" : ""}`}
    >
      {children}
    </div>
  );
}
