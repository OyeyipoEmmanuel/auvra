import { z } from "zod";

const positiveMinor = z.string().regex(/^[1-9]\d*$/);
const nonnegativeMinor = z.string().regex(/^\d+$/);

export const spendPolicySchema = z.object({
  schemaVersion: z.literal(1),
  paused: z.boolean(),
  allowedCurrencies: z.array(z.string().min(1)).min(1),
  allowedServices: z.array(z.string().min(1)).min(1),
  perJobCapMinor: positiveMinor,
  projectCapMinor: positiveMinor,
  dailyCapMinor: positiveMinor,
  autoApprovalCeilingMinor: nonnegativeMinor,
  contributionFloorMinor: nonnegativeMinor,
  firstLiveHireRequiresApproval: z.literal(true),
});

export type SpendPolicy = z.infer<typeof spendPolicySchema>;

export type SpendContext = {
  amountMinor: bigint;
  currency: string;
  serviceId: string;
  projectCommittedMinor: bigint;
  dailyCommittedMinor: bigint;
  customerPaidMinor: bigint;
  supplierCapMinor: bigint;
  firstLiveHire: boolean;
  approvalValid: boolean;
  fundingVerified: boolean;
  marketplaceFundingVerified: boolean;
  paymentProvider: string;
  paymentAsset: string;
};

export function evaluateSpend(policy: SpendPolicy, context: SpendContext): string[] {
  const reasons: string[] = [];
  if (policy.paused) reasons.push("PAUSED");
  if (
    !context.fundingVerified ||
    context.paymentProvider !== "BACHS" ||
    context.paymentAsset.startsWith("DEMO_")
  )
    reasons.push("CUSTOMER_FUNDING_UNVERIFIED");
  if (!context.marketplaceFundingVerified) reasons.push("MARKETPLACE_FUNDING_UNVERIFIED");
  if (context.amountMinor <= 0n) reasons.push("INVALID_AMOUNT");
  if (
    context.currency !== context.paymentAsset ||
    !policy.allowedCurrencies.includes(context.currency)
  )
    reasons.push("CURRENCY_NOT_ALLOWED");
  if (!policy.allowedServices.includes(context.serviceId)) reasons.push("SERVICE_NOT_ALLOWED");
  if (context.amountMinor > BigInt(policy.perJobCapMinor)) reasons.push("JOB_CAP_EXCEEDED");
  if (
    context.projectCommittedMinor + context.amountMinor > BigInt(policy.projectCapMinor) ||
    context.projectCommittedMinor + context.amountMinor > context.supplierCapMinor
  )
    reasons.push("PROJECT_CAP_EXCEEDED");
  if (context.dailyCommittedMinor + context.amountMinor > BigInt(policy.dailyCapMinor))
    reasons.push("DAILY_CAP_EXCEEDED");
  if (
    context.customerPaidMinor - context.projectCommittedMinor - context.amountMinor <
    BigInt(policy.contributionFloorMinor)
  )
    reasons.push("CONTRIBUTION_FLOOR_BREACHED");
  if (
    (context.firstLiveHire || context.amountMinor > BigInt(policy.autoApprovalCeilingMinor)) &&
    !context.approvalValid
  )
    reasons.push("APPROVAL_REQUIRED");
  return reasons;
}
