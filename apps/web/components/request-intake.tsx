"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequestFiles } from "@/components/request-files";

const examples = [
  "Build a landing page",
  "Design a logo",
  "Research competitors",
  "Analyze a dataset",
];
type ApiError = { error?: { message?: string } };
type CreateRequestResponse = { request?: { id: string } } & ApiError;

export type RequestDraft = {
  id: string;
  rawBrief: string;
  desiredOutcome: string | null;
  budgetMinor: string | null;
  budgetCurrency: string | null;
  deadline: string | null;
  constraints: string[];
  files: Array<{ id: string; fileName: string; sizeBytes: number }>;
};

export function RequestIntake({ minDate, draft }: { minDate: string; draft?: RequestDraft }) {
  const router = useRouter();
  const [brief, setBrief] = useState(draft?.rawBrief ?? "");
  const [files, setFiles] = useState(draft?.files ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRequest(formElement: HTMLFormElement, intent: "submit" | "draft") {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData(formElement);
    const budget = String(form.get("budget") ?? "").trim();
    const currency = String(form.get("currency") ?? "USD")
      .trim()
      .toUpperCase();
    const deadline = String(form.get("deadline") ?? "").trim();
    const desiredOutcome = String(form.get("desiredOutcome") ?? "").trim();
    const constraints = String(form.get("constraints") ?? "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const budgetMinor = budget ? toMinorUnits(budget) : undefined;
    if (budget && !budgetMinor) {
      setError("Enter a valid budget with no more than two decimal places.");
      setSubmitting(false);
      return;
    }
    try {
      const payload = {
        rawBrief: brief,
        ...(desiredOutcome ? { desiredOutcome } : {}),
        ...(budgetMinor ? { budgetMinor, budgetCurrency: currency } : {}),
        ...(deadline
          ? { preferredDeadline: new Date(`${deadline}T23:59:59.999Z`).toISOString() }
          : {}),
        constraints,
        attachmentIds: files.map((file) => file.id),
        ...(intent === "submit" ? { consentToExternalAgentProcessing: true } : { mode: "DRAFT" }),
      };
      const endpoint = draft
        ? intent === "submit"
          ? `/api/requests/${draft.id}/submit`
          : `/api/requests/${draft.id}`
        : "/api/requests";
      const response = await fetch(endpoint, {
        method: draft && intent === "draft" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CreateRequestResponse;
      if (!response.ok || (intent === "submit" && !data.request?.id))
        throw new Error(
          data.error?.message ?? "Auvra could not save this request. Please try again.",
        );
      if (intent === "submit") router.push(`/app/requests/${data.request!.id}`);
      else if (draft) router.refresh();
      else router.push(`/app/requests/${data.request!.id}/edit`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Auvra could not save this request. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[980px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link
        href="/app/requests"
        className="inline-flex items-center gap-1.5 text-[14px] text-[#85858e] hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Requests
      </Link>
      <div className="mt-9 max-w-[680px]">
        <p className="text-[13px] font-medium uppercase tracking-[.12em] text-[#9a7cde]">
          New request
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-.05em] sm:text-[40px]">
          What do you need done?
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#a1a1aa]">
          Describe the result you want in your own words. Auvra will ask relevant questions, check
          supplier coverage, and show a quote before funding.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveRequest(event.currentTarget, "submit");
        }}
        className="mt-8 max-w-[760px]"
      >
        <label
          htmlFor="request-brief"
          className="mb-2 block text-[14px] font-medium text-[#e4e4e7]"
        >
          Your brief <span className="text-[#777780]">· required</span>
        </label>
        <Textarea
          id="request-brief"
          name="request"
          required
          minLength={12}
          maxLength={8000}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          className="min-h-56 resize-y rounded-xl border-[#343438] bg-[#141414] p-5 text-[16px] leading-7 placeholder:text-[#74747c]"
          placeholder="For example: Build a modern landing page for my accounting business. It should explain our services, collect consultation requests, and work well on mobile."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] text-[#777780]">Try:</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setBrief(example)}
              className="rounded-md border border-[#333338] px-2.5 py-1.5 text-[13px] text-[#a1a1aa] transition-colors hover:border-[#605274] hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>
        <RequestFiles
          files={files}
          onChange={setFiles}
        />
        <details className="group mt-6 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-medium text-[#d4d4d8] marker:hidden">
            Add budget, deadline, and context{" "}
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-5 border-t border-[var(--ws-border)] p-4">
            <Field
              label="Desired outcome"
              optional
            >
              <Textarea
                name="desiredOutcome"
                defaultValue={draft?.desiredOutcome ?? ""}
                maxLength={1000}
                className="min-h-20"
                placeholder="What would a successful result look like?"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)]">
              <Field
                label="Maximum budget"
                optional
              >
                <Input
                  name="budget"
                  defaultValue={draft?.budgetMinor ? formatMinor(draft.budgetMinor) : ""}
                  inputMode="decimal"
                  pattern="\d+(\.\d{1,2})?"
                  placeholder="e.g. 100.00"
                />
              </Field>
              <Field label="Currency">
                <Input
                  name="currency"
                  defaultValue={draft?.budgetCurrency ?? "USD"}
                  minLength={3}
                  maxLength={12}
                  className="uppercase"
                />
              </Field>
              <Field
                label="Preferred deadline"
                optional
              >
                <Input
                  name="deadline"
                  type="date"
                  min={minDate}
                  defaultValue={draft?.deadline?.slice(0, 10) ?? ""}
                />
              </Field>
            </div>
            <Field
              label="Constraints, links, or context"
              optional
            >
              <Textarea
                name="constraints"
                defaultValue={draft?.constraints.join("\n") ?? ""}
                maxLength={8000}
                className="min-h-24"
                placeholder={"Use our existing brand colors\nReference: https://example.com"}
              />
            </Field>
          </div>
        </details>
        <label className="mt-6 flex items-start gap-3 text-[14px] leading-5 text-[#92929b]">
          <input
            required
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-violet-600"
          />
          <span>
            I understand Auvra may share the minimum necessary task context with specialist agents
            after I approve the final scope and quote.
          </span>
        </label>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-[14px] text-rose-200"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ws-border)] pt-6">
          <p className="inline-flex items-center gap-2 text-[13px] text-[#85858e]">
            <LockKeyhole className="size-3.5" />
            No spending is authorized by submitting.
          </p>
          <div className="flex items-center gap-3">
            <Button
              disabled={submitting}
              type="button"
              variant="outline"
              onClick={(event) => {
                const form = event.currentTarget.closest("form");
                if (form) void saveRequest(form, "draft");
              }}
            >
              Save draft
            </Button>
            <Button
              disabled={submitting}
              type="submit"
              variant="violet"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-medium text-[#d4d4d8]">
        {label} {optional && <span className="font-normal text-[#777780]">· optional</span>}
      </span>
      {children}
    </label>
  );
}
function toMinorUnits(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  const [, whole, fraction = ""] = match;
  return `${whole}${fraction.padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

function formatMinor(value: string) {
  const padded = value.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}
