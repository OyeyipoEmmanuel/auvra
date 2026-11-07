import { describe, expect, it } from "vitest";

import {
  analyzeServiceRequest,
  managerAnalysisSchema,
  managerPlanSchema,
} from "../apps/web/lib/manager-analysis.js";

const input = {
  rawBrief: "Build a landing page for my accounting business.",
  desiredOutcome: "A responsive page that generates consultation requests.",
  constraints: ["Use our existing purple brand colors."],
  budgetMinor: BigInt(100000),
  budgetCurrency: "USD",
  deadline: null,
  answers: [],
};

describe("manager plan boundaries", () => {
  it("uses one contract for distinct categories and emits no more than three questions", () => {
    const landing = analyzeServiceRequest(input);
    const research = analyzeServiceRequest({
      ...input,
      rawBrief: "Research my competitors in Lagos.",
    });
    expect(landing.decision).toBe("NEEDS_CLARIFICATION");
    expect(landing.questions.length).toBeLessThanOrEqual(3);
    expect(research.questions.length).toBeLessThanOrEqual(3);
    expect(landing.category).not.toBe(research.category);
    expect(managerAnalysisSchema.safeParse(landing).success).toBe(true);
    expect(managerAnalysisSchema.safeParse(research).success).toBe(true);
  });

  it("rejects unsafe work before generating a quoteable plan", () => {
    const result = analyzeServiceRequest({
      ...input,
      rawBrief: "Build a phishing kit to steal passwords.",
    });
    expect(result.decision).toBe("UNSUPPORTED");
    expect(result.plan).toBeNull();
    expect(managerAnalysisSchema.safeParse(result).success).toBe(true);
  });

  it("rejects cyclic, missing, duplicate, and overlarge task graphs", () => {
    const base = analyzeServiceRequest({
      ...input,
      answers: [
        { questionId: "audience_offer", question: "Audience?", answer: "Small firms", round: 1 },
      ],
    });
    expect(base.plan).not.toBeNull();
    expect(managerPlanSchema.safeParse(base.plan).success).toBe(true);
    const tasks = base.plan!.tasks;
    expect(tasks.every((task) => task.spendCapMinor === "100000" && task.retryLimit === 0)).toBe(
      true,
    );
    expect(
      managerPlanSchema.safeParse({
        ...base.plan,
        tasks: [
          { ...tasks[0], dependencies: [tasks[1]!.key] },
          { ...tasks[1], dependencies: [tasks[0]!.key] },
        ],
      }).success,
    ).toBe(false);
    expect(
      managerPlanSchema.safeParse({
        ...base.plan,
        tasks: [{ ...tasks[0], dependencies: ["missing"] }],
      }).success,
    ).toBe(false);
    expect(managerPlanSchema.safeParse({ ...base.plan, tasks: [tasks[0], tasks[0]] }).success).toBe(
      false,
    );
    expect(
      managerPlanSchema.safeParse({
        ...base.plan,
        tasks: Array.from({ length: 13 }, (_, index) => ({ ...tasks[0], key: `task_${index}` })),
      }).success,
    ).toBe(false);
  });

  it("treats a changed service category as a new scope", () => {
    const revised = analyzeServiceRequest({
      ...input,
      answers: [
        { questionId: "audience_offer", question: "Audience?", answer: "Small firms", round: 1 },
      ],
      scopeRevision:
        "Replace the landing page with a logo design package for the same business. Use a simple mark, purple palette, and provide SVG and PNG exports.",
    });
    expect(revised.category).toBe("logo_design");
    expect(revised.plan?.assumptions).toContain(
      "Requested scope change: Replace the landing page with a logo design package for the same business. Use a simple mark, purple palette, and provide SVG and PNG exports.",
    );
  });
});
