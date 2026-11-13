"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  Layers3,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export type WalkthroughTask = {
  key: string;
  title: string;
  objective: string;
  supplierName: string | null;
  deliverables: string[];
  acceptanceCriteria: string[];
};

const phases = ["Plan", "Match", "Coordinate", "Review", "Handoff"] as const;

export function ProjectWalkthrough({
  projectId,
  brief,
  tasks,
}: {
  projectId: string;
  brief: string;
  tasks: WalkthroughTask[];
}) {
  const [phase, setPhase] = useState(0);
  const storageKey = `auvra:walkthrough:v1:${projectId}`;

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      if (Number.isInteger(saved) && saved >= 0 && saved < phases.length) {
        setPhase(saved);
      }
    } catch {
      // A private browsing context can disable local storage.
    }
  }, [storageKey]);

  function goTo(nextPhase: number) {
    setPhase(nextPhase);
    try {
      window.localStorage.setItem(storageKey, String(nextPhase));
    } catch {
      // The walkthrough still works for this visit without local storage.
    }
  }

  function downloadSample() {
    const lines = [
      "# Auvra — project brief",
      "",
      "Approved project plan and acceptance checks. This document is not a completed deliverable.",
      "",
      "## Customer brief",
      brief,
      "",
      "## Proposed package",
      ...tasks.flatMap((task) => [
        "",
        `### ${task.title}`,
        task.objective,
        "",
        "Planned deliverables:",
        ...task.deliverables.map((item) => `- ${item}`),
        "",
        "Acceptance checks:",
        ...task.acceptanceCriteria.map((item) => `- ${item}`),
      ]),
      "",
      "Completed artifacts and QA records appear in the project workspace when available.",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auvra-project-brief-${projectId.slice(0, 8)}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section
      aria-labelledby="walkthrough-title"
      className="mt-9 overflow-hidden rounded-2xl border border-violet-300/15 bg-[radial-gradient(circle_at_top_right,rgba(112,68,199,.18),transparent_45%),#131317]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[.07] px-5 py-6 sm:px-7">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[.12em] text-violet-300">
            Project journey
          </p>
          <h2
            id="walkthrough-title"
            className="mt-2 text-[22px] font-semibold tracking-[-.035em] text-white"
          >
            Follow the project plan
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-zinc-400">
            Explore the approved scope, specialist matches, review checks, and handoff structure.
          </p>
        </div>
        <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-3 py-1.5 text-[13px] text-violet-200">
          {String(phase + 1).padStart(2, "0")} / {String(phases.length).padStart(2, "0")}
        </span>
      </div>

      <ol className="grid grid-cols-5 border-b border-white/[.07] px-3 py-4 sm:px-6">
        {phases.map((name, index) => (
          <li
            key={name}
            className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left"
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full border text-[12px] ${
                index <= phase
                  ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                  : "border-white/10 text-zinc-600"
              }`}
            >
              {index < phase ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={`truncate text-[13px] ${index <= phase ? "text-zinc-100" : "text-zinc-600"}`}
            >
              {name}
            </span>
          </li>
        ))}
      </ol>

      <div
        aria-live="polite"
        className="min-h-60 px-5 py-7 sm:px-7"
      >
        {phase === 0 && (
          <PhaseIntro
            icon={<Layers3 className="size-5" />}
            title="The work has a clear shape"
            description={`${tasks.length} planned ${tasks.length === 1 ? "task" : "tasks"} define the outcome, handoff, and acceptance checks.`}
          />
        )}
        {phase === 1 && (
          <div>
            <PhaseIntro
              icon={<Sparkles className="size-5" />}
              title="Specialists matched to the plan"
              description="These specialists were identified during marketplace discovery. Availability is confirmed before hiring."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {tasks.map((task) => (
                <div
                  key={task.key}
                  className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"
                >
                  <p className="text-[13px] text-zinc-500">{task.title}</p>
                  <p className="mt-1 text-[15px] font-medium text-zinc-100">
                    {task.supplierName ?? "Specialist match pending"}
                  </p>
                  <p className="mt-1 text-[13px] text-zinc-500">Marketplace match</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {phase === 2 && (
          <div>
            <PhaseIntro
              icon={<Layers3 className="size-5" />}
              title="Work coordinated task by task"
              description="The approved brief moves through these milestones in dependency order."
            />
            <div className="mt-5 space-y-3">
              {tasks.map((task, index) => (
                <div
                  key={task.key}
                  className="flex gap-4 rounded-xl border border-white/[.08] bg-white/[.025] p-4"
                >
                  <span className="font-mono text-[13px] text-violet-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-zinc-100">{task.title}</p>
                    <p className="mt-1 text-[14px] leading-5 text-zinc-400">{task.objective}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-zinc-400">
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        Input brief
                      </span>
                      <ArrowRight className="size-3 text-zinc-600" />
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        {task.supplierName ?? "Specialist"} review
                      </span>
                      <ArrowRight className="size-3 text-zinc-600" />
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        Output checked
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {phase === 3 && (
          <div>
            <PhaseIntro
              icon={<ClipboardCheck className="size-5" />}
              title="Quality checked before release"
              description="The approved acceptance criteria guide review as outputs arrive."
            />
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {tasks
                .flatMap((task) => task.acceptanceCriteria.slice(0, 2))
                .slice(0, 6)
                .map((item, index) => (
                  <li
                    key={`${index}-${item}`}
                    className="flex gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-4 text-[14px] leading-5 text-zinc-300"
                  >
                    <span className="mt-1 size-2 shrink-0 rounded-full border border-violet-300" />
                    {item}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {phase === 4 && (
          <div>
            <PhaseIntro
              icon={<Download className="size-5" />}
              title="A handoff built around your brief"
              description="The project brief captures planned outputs and acceptance checks in one place."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {tasks
                .flatMap((task) => task.deliverables)
                .slice(0, 6)
                .map((item, index) => (
                  <div
                    key={`${index}-${item}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-4"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-[12px] text-violet-200">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[14px] text-zinc-200">{item}</p>
                  </div>
                ))}
            </div>
            <Button
              className="mt-5"
              onClick={downloadSample}
              variant="outline"
            >
              <Download className="size-4" />
              Download project brief
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] px-5 py-4 sm:px-7">
        <p className="text-[13px] text-zinc-500">
          Project milestones update when work is recorded.
        </p>
        {phase < phases.length - 1 ? (
          <Button
            onClick={() => goTo(phase + 1)}
            variant="violet"
          >
            Explore next step <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={() => goTo(0)}
            variant="outline"
          >
            <RotateCcw className="size-4" />
            Start again
          </Button>
        )}
      </div>
    </section>
  );
}

function PhaseIntro({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
        {icon}
      </span>
      <div>
        <h3 className="text-[18px] font-medium tracking-tight text-white">{title}</h3>
        <p className="mt-1 max-w-2xl text-[14px] leading-6 text-zinc-400">{description}</p>
      </div>
    </div>
  );
}
