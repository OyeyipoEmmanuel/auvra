import { z } from "zod";

export const runtimeModes = ["DEMO_SANDBOX", "LIVE_MARKET"] as const;
export const runtimeModeSchema = z.enum(runtimeModes);

const requestFields = {
  rawBrief: z.string().max(8000),
  desiredOutcome: z.string().trim().max(1000).optional(),
  budgetMinor: z
    .string()
    .regex(/^[1-9]\d{0,17}$/)
    .optional(),
  budgetCurrency: z.string().trim().toUpperCase().min(3).max(12).optional(),
  preferredDeadline: z.string().datetime().optional(),
  constraints: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  attachmentIds: z.array(z.string().uuid()).max(10).default([]),
};

function checkBudget(
  value: { budgetMinor?: string | undefined; budgetCurrency?: string | undefined },
  context: z.RefinementCtx,
) {
  if (
    (value.budgetMinor && !value.budgetCurrency) ||
    (!value.budgetMinor && value.budgetCurrency)
  ) {
    context.addIssue({
      code: "custom",
      path: ["budgetCurrency"],
      message: "Budget amount and currency must be provided together.",
    });
  }
}

export const draftRequestSchema = z.object(requestFields).superRefine(checkBudget);

export const serviceRequestSchema = z
  .object({
    ...requestFields,
    rawBrief: z
      .string()
      .max(8000)
      .refine((value) => value.trim().length >= 12),
    consentToExternalAgentProcessing: z.literal(true),
  })
  .superRefine((value, context) => {
    checkBudget(value, context);
    if (value.preferredDeadline && new Date(value.preferredDeadline).getTime() <= Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["preferredDeadline"],
        message: "The requested deadline must be in the future.",
      });
    }
  });

export const requestStates = [
  "DRAFT",
  "SUBMITTED",
  "ANALYZING",
  "NEEDS_CLARIFICATION",
  "SCOPED",
  "QUOTED",
  "APPROVED",
  "AWAITING_FUNDS",
  "FUNDED",
  "PROJECT_CREATED",
  "UNSUPPORTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;

export const projectStates = [
  "PLANNING",
  "PROCUREMENT",
  "RUNNING",
  "QA",
  "CUSTOMER_REVIEW",
  "DELIVERED",
  "CLOSED",
  "BLOCKED",
  "REVISION",
  "DISPUTED",
  "CANCELLED",
  "FAILED",
] as const;

export const supplierJobStates = [
  "PROPOSED",
  "APPROVED_TO_HIRE",
  "CREATE_PENDING",
  "HIRED",
  "ACTIVE",
  "SUBMITTED",
  "QA_PASSED",
  "ACCEPTED",
  "QA_FAILED",
  "REVISION_REQUESTED",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
] as const;

export const paymentStates = [
  "CREATED",
  "PENDING",
  "VERIFIED",
  "ALLOCATED",
  "RECONCILED",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
] as const;

export const receiptAnchorStates = [
  "PENDING",
  "SUBMITTED",
  "CONFIRMED",
  "RETRY_PENDING",
  "RECONCILIATION_REQUIRED",
  "FAILED",
] as const;

export const requestStateSchema = z.enum(requestStates);
export const projectStateSchema = z.enum(projectStates);
export const supplierJobStateSchema = z.enum(supplierJobStates);
export const paymentStateSchema = z.enum(paymentStates);
export const receiptAnchorStateSchema = z.enum(receiptAnchorStates);

type StateMap<TState extends string> = Readonly<Record<TState, readonly TState[]>>;

export const requestTransitions = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ANALYZING", "CANCELLED"],
  ANALYZING: ["NEEDS_CLARIFICATION", "SCOPED", "UNSUPPORTED", "REJECTED", "CANCELLED"],
  NEEDS_CLARIFICATION: ["ANALYZING", "CANCELLED", "EXPIRED"],
  SCOPED: ["QUOTED", "UNSUPPORTED", "CANCELLED"],
  QUOTED: ["APPROVED", "SCOPED", "CANCELLED", "EXPIRED"],
  APPROVED: ["AWAITING_FUNDS", "CANCELLED", "EXPIRED"],
  AWAITING_FUNDS: ["FUNDED", "CANCELLED", "EXPIRED"],
  FUNDED: ["PROJECT_CREATED"],
  PROJECT_CREATED: [],
  UNSUPPORTED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
} satisfies StateMap<RequestState>;

export const projectTransitions = {
  PLANNING: ["PROCUREMENT", "BLOCKED", "CANCELLED", "FAILED"],
  PROCUREMENT: ["RUNNING", "BLOCKED", "CANCELLED", "FAILED"],
  RUNNING: ["QA", "BLOCKED", "REVISION", "DISPUTED", "CANCELLED", "FAILED"],
  QA: ["CUSTOMER_REVIEW", "REVISION", "BLOCKED", "FAILED"],
  CUSTOMER_REVIEW: ["DELIVERED", "REVISION", "DISPUTED", "CANCELLED"],
  DELIVERED: ["CLOSED", "DISPUTED"],
  CLOSED: [],
  BLOCKED: ["PLANNING", "PROCUREMENT", "RUNNING", "QA", "CUSTOMER_REVIEW", "CANCELLED", "FAILED"],
  REVISION: ["RUNNING", "QA", "BLOCKED", "FAILED"],
  DISPUTED: ["CUSTOMER_REVIEW", "CANCELLED", "FAILED"],
  CANCELLED: [],
  FAILED: [],
} satisfies StateMap<ProjectState>;

export const supplierJobTransitions = {
  PROPOSED: ["APPROVED_TO_HIRE", "CANCELLED", "EXPIRED"],
  APPROVED_TO_HIRE: ["CREATE_PENDING", "CANCELLED", "EXPIRED"],
  CREATE_PENDING: ["HIRED", "FAILED", "CANCELLED"],
  HIRED: ["ACTIVE", "FAILED", "CANCELLED", "EXPIRED"],
  ACTIVE: ["SUBMITTED", "FAILED", "CANCELLED", "EXPIRED"],
  SUBMITTED: ["QA_PASSED", "QA_FAILED", "FAILED"],
  QA_PASSED: ["ACCEPTED", "FAILED"],
  ACCEPTED: [],
  QA_FAILED: ["REVISION_REQUESTED", "FAILED"],
  REVISION_REQUESTED: ["ACTIVE", "SUBMITTED", "FAILED", "CANCELLED", "EXPIRED"],
  CANCELLED: [],
  FAILED: [],
  EXPIRED: [],
} satisfies StateMap<SupplierJobState>;

export const paymentTransitions = {
  CREATED: ["PENDING", "FAILED"],
  PENDING: ["VERIFIED", "FAILED", "DISPUTED"],
  VERIFIED: ["ALLOCATED", "REFUND_PENDING", "DISPUTED"],
  ALLOCATED: ["RECONCILED", "REFUND_PENDING", "DISPUTED"],
  RECONCILED: ["REFUND_PENDING", "DISPUTED"],
  FAILED: [],
  REFUND_PENDING: ["REFUNDED", "DISPUTED"],
  REFUNDED: [],
  DISPUTED: ["ALLOCATED", "RECONCILED", "REFUND_PENDING", "REFUNDED"],
} satisfies StateMap<PaymentState>;

export const receiptAnchorTransitions = {
  PENDING: ["SUBMITTED", "RETRY_PENDING", "FAILED"],
  SUBMITTED: ["CONFIRMED", "RECONCILIATION_REQUIRED", "RETRY_PENDING", "FAILED"],
  CONFIRMED: [],
  RETRY_PENDING: ["SUBMITTED", "RECONCILIATION_REQUIRED", "FAILED"],
  RECONCILIATION_REQUIRED: ["CONFIRMED", "SUBMITTED", "RETRY_PENDING", "FAILED"],
  FAILED: [],
} satisfies StateMap<ReceiptAnchorState>;

export function canTransition<TState extends string>(
  map: StateMap<TState>,
  from: TState,
  to: TState,
): boolean {
  return map[from].includes(to);
}

export function assertTransition<TState extends string>(
  map: StateMap<TState>,
  from: TState,
  to: TState,
): void {
  if (!canTransition(map, from, to)) throw new Error(`Illegal state transition: ${from} -> ${to}`);
}

export type RuntimeMode = z.infer<typeof runtimeModeSchema>;
export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;
export type RequestState = z.infer<typeof requestStateSchema>;
export type ProjectState = z.infer<typeof projectStateSchema>;
export type SupplierJobState = z.infer<typeof supplierJobStateSchema>;
export type PaymentState = z.infer<typeof paymentStateSchema>;
export type ReceiptAnchorState = z.infer<typeof receiptAnchorStateSchema>;
