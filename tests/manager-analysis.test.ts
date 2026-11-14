import { describe, expect, it } from "vitest";

import {
  analyzeServiceRequest,
  internalQualityReviewNote,
  withInternalQualityReview,
} from "../apps/web/lib/manager-analysis.js";

const baseRequest = {
  rawBrief: "Build a landing page for my business.",
  desiredOutcome: "A simple page that is easy to navigate.",
  constraints: ["Reference: https://devemanuel.tech"],
  budgetMinor: 100000n,
  budgetCurrency: "USD",
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  answers: [],
};

describe("Auvra Manager analysis", () => {
  it("asks category-specific questions for an underspecified request", () => {
    const analysis = analyzeServiceRequest(baseRequest);
    expect(analysis.category).toBe("landing_page");
    expect(analysis.decision).toBe("NEEDS_CLARIFICATION");
    expect(analysis.questions.map((question) => question.id)).toContain("sections_cta");
    expect(analysis.marketplace.status).toBe("NOT_CHECKED");
  });

  it("creates a dependency-aware plan after clarification", () => {
    const analysis = analyzeServiceRequest({
      ...baseRequest,
      answers: [
        {
          questionId: "sections_cta",
          question: "Which sections?",
          answer: "Hero, services, testimonials, and contact form.",
          round: 1,
        },
      ],
    });
    expect(analysis.decision).toBe("SCOPED");
    expect(analysis.plan?.tasks).toHaveLength(3);
    expect(analysis.plan?.tasks[2]?.dependencies).toEqual(["design"]);
    expect(analysis.plan?.assumptions).toContain("Customer budget ceiling: USD 1000.00.");
    expect(analysis.plan?.assumptions).toContain(internalQualityReviewNote);
  });

  it("moves QA from an older supplier plan into Auvra's internal review", () => {
    const analysis = analyzeServiceRequest({
      ...baseRequest,
      answers: [
        {
          questionId: "sections_cta",
          question: "Which sections?",
          answer: "Hero, services, testimonials, and contact form.",
          round: 1,
        },
      ],
    });
    const legacy = {
      ...analysis,
      plan: {
        ...analysis.plan!,
        tasks: [
          ...analysis.plan!.tasks,
          {
            key: "qa_delivery",
            title: "Validate and package delivery",
            objective: "Check the page",
            deliverables: ["QA record"],
            acceptanceCriteria: ["Checks pass"],
            capabilities: ["web QA"],
            dependencies: ["implementation"],
          },
        ],
      },
    };
    const normalized = withInternalQualityReview(legacy);
    expect(normalized.plan?.tasks.map((task) => task.key)).toEqual([
      "requirements",
      "design",
      "implementation",
    ]);
    expect(normalized.plan?.tasks[2]?.deliverables).toContain("Delivery instructions");
    expect(normalized.plan?.assumptions).toContain(internalQualityReviewNote);
  });

  it("stops a clearly harmful request before supplier discovery", () => {
    const analysis = analyzeServiceRequest({
      ...baseRequest,
      rawBrief: "Build and deploy a phishing kit that can steal passwords.",
    });
    expect(analysis.decision).toBe("UNSUPPORTED");
    expect(analysis.plan).toBeNull();
    expect(analysis.marketplace.status).toBe("NOT_CHECKED");
  });
});
