import { z } from "zod";

export type ManagerQuestion = {
  id: string;
  prompt: string;
  reason: string;
};

export type ManagerTask = {
  key: string;
  title: string;
  objective: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  capabilities: string[];
  dependencies: string[];
  spendCapMinor?: string | null;
  deadline?: string | null;
  retryLimit?: number;
};

export type ManagerAnalysis = {
  schemaVersion: 1;
  engine: "AUVRA_RULES_V1";
  round: number;
  category: string;
  categoryLabel: string;
  summary: string;
  decision: "NEEDS_CLARIFICATION" | "SCOPED" | "UNSUPPORTED";
  decisionReason: string;
  questions: ManagerQuestion[];
  plan: null | {
    title: string;
    objective: string;
    assumptions: string[];
    tasks: ManagerTask[];
  };
  marketplace: {
    status: "NOT_CHECKED";
    note: string;
  };
  discovery?: {
    runId: string;
    status: "READY_FOR_QUOTE" | "NOT_AVAILABLE" | "OVER_BUDGET";
    observedAt: string;
    catalogServiceCount: number;
    eligibleMatchCount: number;
    missingTaskKeys: string[];
    selected: Array<{
      taskKey: string;
      serviceName: string;
      externalServiceId: string;
      priceMinor: string;
      currency: string;
      score: number;
      reasons: string[];
    }>;
    explanation: string;
    quoteId?: string;
    quotedTotalMinor?: string;
    quotedCurrency?: string;
  };
  generatedAt: string;
  scopeRevision?: string;
};

type AnalysisInput = {
  rawBrief: string;
  desiredOutcome: string | null;
  constraints: string[];
  budgetMinor: bigint | null;
  budgetCurrency: string | null;
  deadline: Date | null;
  answers: Array<{ questionId: string; question: string; answer: string; round: number }>;
  scopeRevision?: string | null;
};

const nonempty = z.string().trim().min(1);
export const managerQuestionSchema = z.object({
  id: nonempty.max(80),
  prompt: nonempty.max(500),
  reason: nonempty.max(500),
});
export const managerTaskSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  title: nonempty.max(200),
  objective: nonempty.max(2000),
  deliverables: z.array(nonempty.max(300)).min(1).max(12),
  acceptanceCriteria: z.array(nonempty.max(500)).min(1).max(12),
  capabilities: z.array(nonempty.max(100)).min(1).max(12),
  dependencies: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)).max(12),
  spendCapMinor: z.string().regex(/^\d+$/).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  retryLimit: z.number().int().min(0).max(2).optional(),
});
export const managerPlanSchema = z
  .object({
    title: nonempty.max(200),
    objective: nonempty.max(2000),
    assumptions: z.array(nonempty.max(2000)).max(30),
    tasks: z.array(managerTaskSchema).min(1).max(12),
  })
  .superRefine((plan, context) => {
    const keys = new Set(plan.tasks.map((task) => task.key));
    if (keys.size !== plan.tasks.length) {
      context.addIssue({ code: "custom", path: ["tasks"], message: "Task keys must be unique." });
    }
    const byKey = new Map(plan.tasks.map((task) => [task.key, task]));
    for (const task of plan.tasks) {
      for (const dependency of task.dependencies) {
        if (!keys.has(dependency) || dependency === task.key) {
          context.addIssue({
            code: "custom",
            path: ["tasks", task.key, "dependencies"],
            message: "Dependencies must refer to other tasks in the plan.",
          });
        }
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(key: string): boolean {
      if (visiting.has(key)) return false;
      if (visited.has(key)) return true;
      visiting.add(key);
      for (const dependency of byKey.get(key)?.dependencies ?? []) {
        if (byKey.has(dependency) && !visit(dependency)) return false;
      }
      visiting.delete(key);
      visited.add(key);
      return true;
    }
    if (plan.tasks.some((task) => !visit(task.key))) {
      context.addIssue({ code: "custom", path: ["tasks"], message: "Task plan is cyclic." });
    }
  });

export const managerAnalysisSchema = z
  .object({
    schemaVersion: z.literal(1),
    engine: z.literal("AUVRA_RULES_V1"),
    round: z.number().int().min(1).max(2),
    category: nonempty,
    categoryLabel: nonempty,
    summary: nonempty,
    decision: z.enum(["NEEDS_CLARIFICATION", "SCOPED", "UNSUPPORTED"]),
    decisionReason: nonempty,
    questions: z.array(managerQuestionSchema).max(4), // Existing v1 records may have four; new runs emit at most three.
    plan: managerPlanSchema.nullable(),
    marketplace: z.object({ status: z.literal("NOT_CHECKED"), note: nonempty }),
    discovery: z
      .object({
        runId: z.string().uuid(),
        status: z.enum(["READY_FOR_QUOTE", "NOT_AVAILABLE", "OVER_BUDGET"]),
        observedAt: z.string().datetime(),
        catalogServiceCount: z.number().int().nonnegative(),
        eligibleMatchCount: z.number().int().nonnegative(),
        missingTaskKeys: z.array(nonempty),
        selected: z.array(
          z.object({
            taskKey: nonempty,
            serviceName: nonempty,
            externalServiceId: nonempty,
            priceMinor: z.string().regex(/^\d+$/),
            currency: nonempty,
            score: z.number().finite(),
            reasons: z.array(nonempty),
          }),
        ),
        explanation: nonempty,
        quoteId: z.string().uuid().optional(),
        quotedTotalMinor: z
          .string()
          .regex(/^[1-9]\d*$/)
          .optional(),
        quotedCurrency: nonempty.optional(),
      })
      .optional(),
    generatedAt: z.string().datetime(),
    scopeRevision: nonempty.max(2000).optional(),
  })
  .superRefine((analysis, context) => {
    if (analysis.decision === "SCOPED" && !analysis.plan) {
      context.addIssue({
        code: "custom",
        path: ["plan"],
        message: "Scoped analysis requires a plan.",
      });
    }
    if (analysis.decision !== "SCOPED" && analysis.plan) {
      context.addIssue({
        code: "custom",
        path: ["plan"],
        message: "Unscoped analysis cannot contain a plan.",
      });
    }
    if (analysis.decision === "NEEDS_CLARIFICATION" && analysis.questions.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Clarification needs questions.",
      });
    }
  });

const categories = [
  {
    key: "landing_page",
    label: "Landing page delivery",
    pattern: /\b(landing page|website|web site|homepage|webpage)\b/i,
  },
  {
    key: "competitor_research",
    label: "Competitor research",
    pattern: /\b(competitor|competitive research|market research)\b/i,
  },
  {
    key: "marketing_strategy",
    label: "Marketing strategy",
    pattern: /\b(marketing|go[- ]to[- ]market|growth strategy|campaign)\b/i,
  },
  {
    key: "logo_design",
    label: "Logo and identity design",
    pattern: /\b(logo|brand identity|visual identity)\b/i,
  },
  {
    key: "data_analysis",
    label: "Data analysis",
    pattern: /\b(analy[sz]e|analysis|dataset|spreadsheet|csv|data)\b/i,
  },
] as const;

const unsafePattern =
  /\b(ransomware|credential theft|steal passwords|phishing kit|malware deployment|harm someone)\b/i;

export function analyzeServiceRequest(input: AnalysisInput): ManagerAnalysis {
  const combined = [
    input.rawBrief,
    input.desiredOutcome,
    ...input.constraints,
    ...input.answers.map((answer) => answer.answer),
    input.scopeRevision,
  ]
    .filter(Boolean)
    .join("\n");
  const replacement = input.scopeRevision?.match(/\b(?:with|to|instead of)\b([\s\S]*)/i)?.[1];
  const category = categories.find(
    (candidate) => replacement && candidate.pattern.test(replacement),
  ) ??
    categories.find(
      (candidate) => input.scopeRevision && candidate.pattern.test(input.scopeRevision),
    ) ??
    categories.find((candidate) => candidate.pattern.test(combined)) ?? {
      key: "general_service",
      label: "Custom digital service",
    };
  const round = Math.min(
    2,
    input.answers.reduce((highest, answer) => Math.max(highest, answer.round), 0) + 1,
  );
  const base = {
    schemaVersion: 1 as const,
    engine: "AUVRA_RULES_V1" as const,
    round,
    category: category.key,
    categoryLabel: category.label,
    summary: summarize(input.rawBrief),
    marketplace: {
      status: "NOT_CHECKED" as const,
      note: "Supplier discovery starts only after the scope is complete. No marketplace availability is claimed yet.",
    },
    generatedAt: new Date().toISOString(),
    ...(input.scopeRevision ? { scopeRevision: input.scopeRevision } : {}),
  };

  if (unsafePattern.test(combined)) {
    return {
      ...base,
      decision: "UNSUPPORTED",
      decisionReason:
        "The request appears to include a harmful or prohibited objective and cannot proceed to supplier discovery.",
      questions: [],
      plan: null,
    };
  }

  if (input.deadline && input.deadline.getTime() <= Date.now()) {
    return {
      ...base,
      decision: "UNSUPPORTED",
      decisionReason:
        "The requested deadline has already passed. Submit a new future deadline before planning.",
      questions: [],
      plan: null,
    };
  }

  const relevantQuestionIds = new Set(questionsFor(category.key).map((question) => question.id));
  const sufficientlyDetailed =
    input.answers.some((answer) => relevantQuestionIds.has(answer.questionId)) ||
    (input.scopeRevision?.trim().length ?? 0) >= 80 ||
    (input.rawBrief.trim().length >= 240 &&
      (input.desiredOutcome?.trim().length ?? 0) >= 30 &&
      input.constraints.length >= 2);

  if (!sufficientlyDetailed) {
    const questions = questionsFor(category.key).slice(0, 3);
    return {
      ...base,
      decision: "NEEDS_CLARIFICATION",
      decisionReason:
        "Auvra needs a few outcome-specific details before it can produce a testable scope.",
      questions,
      plan: null,
    };
  }

  return {
    ...base,
    decision: "SCOPED",
    decisionReason: "The brief and clarification answers are sufficient for an initial task plan.",
    questions: [],
    plan: buildPlan(category.key, category.label, input),
  };
}

export function isManagerAnalysis(value: unknown): value is ManagerAnalysis {
  return managerAnalysisSchema.safeParse(value).success;
}

function questionsFor(category: string): ManagerQuestion[] {
  const common: Record<string, ManagerQuestion[]> = {
    landing_page: [
      {
        id: "audience_offer",
        prompt:
          "Who is the primary audience, and what product or service should the page persuade them to choose?",
        reason: "This determines the message hierarchy and conversion path.",
      },
      {
        id: "sections_cta",
        prompt: "Which sections and primary call to action must the page include?",
        reason: "This establishes the required content and page structure.",
      },
      {
        id: "brand_assets",
        prompt: "What brand assets, copy, images, or visual references are available?",
        reason: "This separates supplied inputs from work Auvra must create.",
      },
      {
        id: "delivery_target",
        prompt:
          "Should the result be source code only, or deployed to a specific platform or domain?",
        reason: "Deployment changes the deliverables and acceptance checks.",
      },
    ],
    competitor_research: [
      {
        id: "business_market",
        prompt: "What business, product, and geographic market should the research represent?",
        reason: "Competitors are only meaningful within a defined market.",
      },
      {
        id: "known_competitors",
        prompt: "Are there known competitors to include or exclude?",
        reason: "This provides a grounded starting set without limiting discovery.",
      },
      {
        id: "decision",
        prompt: "What decision should the research help you make?",
        reason: "The decision determines which evidence and comparisons matter.",
      },
    ],
    marketing_strategy: [
      {
        id: "audience_offer",
        prompt: "Who is the target customer and what offer are you promoting?",
        reason: "Strategy requires a defined audience and value proposition.",
      },
      {
        id: "goal_metric",
        prompt: "What business goal and measurable result should the strategy target?",
        reason: "This creates measurable acceptance criteria.",
      },
      {
        id: "channels_assets",
        prompt: "Which channels, existing assets, and restrictions should the plan account for?",
        reason: "This keeps recommendations executable.",
      },
    ],
    logo_design: [
      {
        id: "brand_audience",
        prompt: "What does the brand do, and who should the identity appeal to?",
        reason: "The mark must communicate the correct positioning.",
      },
      {
        id: "style_references",
        prompt: "What visual qualities, colors, references, or symbols should be used or avoided?",
        reason: "This defines the creative direction and boundaries.",
      },
      {
        id: "logo_formats",
        prompt: "Which logo variations and export formats do you need?",
        reason: "This defines the final delivery package.",
      },
    ],
    data_analysis: [
      {
        id: "data_source",
        prompt:
          "What dataset will be provided, in which format, and what does each important field represent?",
        reason: "The analysis cannot be validated without understanding its inputs.",
      },
      {
        id: "analysis_question",
        prompt: "Which questions or decisions should the analysis answer?",
        reason: "This prevents producing irrelevant statistics.",
      },
      {
        id: "output_format",
        prompt:
          "Do you need a report, cleaned dataset, charts, reproducible code, or a combination?",
        reason: "This defines the required artifacts.",
      },
    ],
    general_service: [
      {
        id: "success_definition",
        prompt: "What exact result should be delivered, and how will you decide it is successful?",
        reason: "Auvra needs a verifiable outcome rather than an activity.",
      },
      {
        id: "inputs",
        prompt: "What inputs, references, accounts, or assets will you provide?",
        reason: "This identifies dependencies and access requirements.",
      },
      {
        id: "output_format",
        prompt: "What format should the final delivery use?",
        reason: "This defines an inspectable deliverable.",
      },
    ],
  };
  return common[category] ?? common.general_service!;
}

function buildPlan(category: string, label: string, input: AnalysisInput) {
  const taskSets: Record<string, ManagerTask[]> = {
    landing_page: [
      task(
        "requirements",
        "Confirm content and conversion requirements",
        "Turn the brief and answers into an approved page outline.",
        ["Page outline", "Content and asset inventory"],
        [
          "Every required section and call to action is listed",
          "Missing customer inputs are explicit",
        ],
        ["content strategy", "requirements analysis"],
      ),
      task(
        "design",
        "Create the responsive visual direction",
        "Define layout, hierarchy, typography, color, and interaction behavior.",
        ["Responsive design direction", "Component and interaction specification"],
        ["Design reflects supplied brand references", "Mobile and desktop layouts are covered"],
        ["web design", "UI/UX"],
        ["requirements"],
      ),
      task(
        "implementation",
        "Build the landing page",
        "Implement the approved experience as production-ready responsive code.",
        ["Landing-page source code", "Reusable components"],
        [
          "Required sections and links work",
          "Layout is responsive",
          "No critical accessibility errors",
        ],
        ["frontend development", "responsive web"],
        ["design"],
      ),
      task(
        "qa_delivery",
        "Validate and package delivery",
        "Test the page against the scope and prepare the agreed delivery target.",
        ["QA evidence", "Final source or deployment"],
        ["Acceptance criteria pass", "Delivery instructions are included"],
        ["web QA", "deployment"],
        ["implementation"],
      ),
    ],
    competitor_research: [
      task(
        "research_scope",
        "Define the comparison framework",
        "Translate the business decision into evidence fields and source rules.",
        ["Competitor criteria", "Comparison framework"],
        ["Market and decision are explicit", "Evidence standards are defined"],
        ["market research"],
      ),
      task(
        "evidence_collection",
        "Collect competitor evidence",
        "Identify relevant competitors and capture attributable current evidence.",
        ["Source register", "Competitor evidence set"],
        ["Claims link to sources", "Required competitors are covered"],
        ["web research"],
        ["research_scope"],
      ),
      task(
        "analysis",
        "Analyze positioning and gaps",
        "Compare competitors and derive decision-relevant patterns.",
        ["Comparison matrix", "Findings and opportunities"],
        ["Findings trace to evidence", "Uncertainty is disclosed"],
        ["competitive analysis"],
        ["evidence_collection"],
      ),
      task(
        "report",
        "Produce the decision report",
        "Package findings and recommendations in the requested format.",
        ["Final research report"],
        ["The stated decision is directly addressed", "Sources and research date are visible"],
        ["business writing"],
        ["analysis"],
      ),
    ],
    marketing_strategy: genericPlan("marketing strategy", "strategy document", [
      "marketing strategy",
      "audience research",
    ]),
    logo_design: genericPlan("logo identity", "logo package", ["graphic design", "brand identity"]),
    data_analysis: genericPlan("data analysis", "analysis package", [
      "data analysis",
      "data visualization",
    ]),
    general_service: genericPlan("requested outcome", "final delivery package", [
      "requirements analysis",
      "specialist delivery",
    ]),
  };

  const answerAssumptions = input.answers.map((answer) => `${answer.question}: ${answer.answer}`);
  return {
    title: label,
    objective: input.scopeRevision
      ? `${input.desiredOutcome?.trim() || summarize(input.rawBrief)} Revised scope: ${input.scopeRevision}`
      : input.desiredOutcome?.trim() || summarize(input.rawBrief),
    assumptions: [
      ...answerAssumptions,
      ...(input.budgetMinor && input.budgetCurrency
        ? [`Customer budget ceiling: ${formatMinor(input.budgetMinor, input.budgetCurrency)}.`]
        : ["No customer budget ceiling has been supplied."]),
      ...(input.deadline
        ? [`Preferred deadline: ${input.deadline.toISOString().slice(0, 10)}.`]
        : ["No preferred deadline has been supplied."]),
      "Supplier availability and exact cost remain unverified until marketplace discovery.",
      ...(input.scopeRevision ? [`Requested scope change: ${input.scopeRevision}`] : []),
    ],
    tasks: (taskSets[category] ?? taskSets.general_service!).map((plannedTask) => ({
      ...plannedTask,
      spendCapMinor: input.budgetMinor?.toString() ?? null,
      deadline: input.deadline?.toISOString() ?? null,
      retryLimit: 0,
    })),
  };
}

function genericPlan(
  subject: string,
  finalArtifact: string,
  capabilities: string[],
): ManagerTask[] {
  return [
    task(
      "requirements",
      "Validate requirements and inputs",
      `Turn the request into a complete ${subject} specification.`,
      ["Requirements brief", "Input inventory"],
      ["Outcome and exclusions are explicit", "Dependencies are identified"],
      ["requirements analysis"],
    ),
    task(
      "production",
      `Produce the ${subject}`,
      "Complete the specialist work against the approved requirements.",
      [finalArtifact],
      ["All approved requirements are addressed", "The artifact uses the requested format"],
      capabilities,
      ["requirements"],
    ),
    task(
      "qa",
      "Validate and package delivery",
      "Check the work against acceptance criteria and prepare the final handoff.",
      ["QA record", "Final delivery package"],
      ["Acceptance checks pass", "Limitations and usage instructions are documented"],
      ["quality assurance"],
      ["production"],
    ),
  ];
}

function task(
  key: string,
  title: string,
  objective: string,
  deliverables: string[],
  acceptanceCriteria: string[],
  capabilities: string[],
  dependencies: string[] = [],
): ManagerTask {
  return { key, title, objective, deliverables, acceptanceCriteria, capabilities, dependencies };
}

function summarize(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= 220 ? normalized : `${normalized.slice(0, 217)}...`;
}

function formatMinor(minor: bigint, currency: string) {
  const value = minor.toString().padStart(3, "0");
  return `${currency} ${value.slice(0, -2)}.${value.slice(-2)}`;
}
