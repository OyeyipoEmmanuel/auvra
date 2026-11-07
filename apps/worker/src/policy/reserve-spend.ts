import { Prisma, type PrismaClient } from "@prisma/client";

import { evaluateSpend, spendPolicySchema } from "./spend-policy.js";
import { configuredBuyerFundingProbe } from "../marketplace/buyer-funding.js";

export type MarketplaceFundingProof = {
  source: "MARKETPLACE_API" | "MARKETPLACE_MCP";
  asset: string;
  availableMinor: bigint;
  observedAt: Date;
};

type ReserveInput = {
  projectId: string;
  taskId: string;
  serviceId: string;
  amountMinor: bigint;
  currency: string;
  approvalId?: string;
  idempotencyKey: string;
};

/** Only the worker supplies this read-only, authenticated marketplace balance probe. */
export async function reserveSupplierSpend(
  db: PrismaClient,
  input: ReserveInput,
  verifyMarketplaceFunding: () => Promise<MarketplaceFundingProof | null> = configuredBuyerFundingProbe(
    db,
    input.currency,
  ),
) {
  const funding = await verifyMarketplaceFunding();
  if (
    !funding ||
    !["MARKETPLACE_API", "MARKETPLACE_MCP"].includes(funding.source) ||
    funding.asset !== input.currency ||
    funding.availableMinor < input.amountMinor ||
    Date.now() - funding.observedAt.getTime() > 60_000 ||
    funding.observedAt.getTime() > Date.now()
  ) {
    return { kind: "MARKETPLACE_FUNDING_UNVERIFIED" as const };
  }

  return db.$transaction(
    async (tx) => {
      // Serializes project and UTC-day cap calculations across all worker instances.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8431189201)`;
      if (Date.now() - funding.observedAt.getTime() > 60_000)
        return { kind: "MARKETPLACE_FUNDING_UNVERIFIED" as const };
      const replay = await tx.spendReservation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (replay) return { kind: "ALREADY_RESERVED" as const, reservationId: replay.id };

      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        include: {
          payments: {
            where: {
              provider: "BACHS",
              state: { in: ["VERIFIED", "ALLOCATED", "RECONCILED"] },
            },
          },
          request: {
            include: {
              quotes: { where: { state: "ACCEPTED" }, orderBy: { version: "desc" }, take: 1 },
            },
          },
        },
      });
      const task = await tx.projectTask.findFirst({
        where: { id: input.taskId, projectId: input.projectId },
      });
      const activePolicies = await tx.policyVersion.findMany({
        where: { policyKey: "LIVE_PROCUREMENT", active: true },
        orderBy: { version: "desc" },
        take: 2,
      });
      if (activePolicies.length !== 1) return { kind: "INVALID_POLICY" as const };
      const policyRecord = activePolicies[0];
      if (!project || !task || !policyRecord || project.request.quotes.length !== 1) {
        return { kind: "NOT_READY" as const };
      }
      const parsed = spendPolicySchema.safeParse(policyRecord.rulesJson);
      if (!parsed.success) return { kind: "INVALID_POLICY" as const };
      const quote = project.request.quotes[0];
      if (!quote) return { kind: "NOT_READY" as const };
      const payment = project.payments.find(
        (item) =>
          item.quoteId === quote.id &&
          item.currency === input.currency &&
          item.verifiedAt &&
          item.amountMinor === quote.customerTotalMinor,
      );
      const now = new Date();
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const [projectReservations, dailyReservations, buyerReservations, completedHires, approval] =
        await Promise.all([
          tx.spendReservation.aggregate({
            where: { projectId: input.projectId, state: "RESERVED", currency: input.currency },
            _sum: { amountMinor: true },
          }),
          tx.spendReservation.aggregate({
            where: { state: "RESERVED", currency: input.currency, createdAt: { gte: dayStart } },
            _sum: { amountMinor: true },
          }),
          tx.spendReservation.aggregate({
            where: { state: "RESERVED", currency: input.currency },
            _sum: { amountMinor: true },
          }),
          tx.supplierJob.count({
            where: { state: { in: ["HIRED", "ACTIVE", "SUBMITTED", "QA_PASSED", "ACCEPTED"] } },
          }),
          input.approvalId ? tx.approval.findUnique({ where: { id: input.approvalId } }) : null,
        ]);
      const decider = approval?.decidedById
        ? await tx.user.findUnique({ where: { id: approval.decidedById }, select: { role: true } })
        : null;
      const approvalValid = Boolean(
        approval &&
        approval.state === "APPROVED" &&
        !approval.consumedAt &&
        (!approval.expiresAt || approval.expiresAt > now) &&
        approval.projectId === input.projectId &&
        approval.policyVersionId === policyRecord.id &&
        approval.currency === input.currency &&
        approval.amountMinor !== null &&
        approval.amountMinor >= input.amountMinor &&
        approval.decidedById &&
        approval.decidedById !== approval.requestedById &&
        (decider?.role === "OPERATOR" || decider?.role === "ADMIN"),
      );
      const reasons = evaluateSpend(parsed.data, {
        amountMinor: input.amountMinor,
        currency: input.currency,
        serviceId: input.serviceId,
        projectCommittedMinor: projectReservations._sum.amountMinor ?? 0n,
        dailyCommittedMinor: dailyReservations._sum.amountMinor ?? 0n,
        customerPaidMinor: payment?.amountMinor ?? 0n,
        supplierCapMinor: quote.supplierCapMinor,
        firstLiveHire: completedHires === 0,
        approvalValid,
        fundingVerified: Boolean(payment),
        marketplaceFundingVerified:
          (buyerReservations._sum.amountMinor ?? 0n) + input.amountMinor <= funding.availableMinor,
        paymentProvider: payment?.provider ?? "",
        paymentAsset: payment?.currency ?? "",
      });
      if (task.budgetCurrency !== input.currency || input.amountMinor > task.budgetMinor)
        reasons.push("TASK_BUDGET_EXCEEDED");
      if (quote.currency !== input.currency) reasons.push("QUOTE_ASSET_MISMATCH");
      if (reasons.length > 0) return { kind: "DENIED" as const, reasons };

      const reservation = await tx.spendReservation.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          projectId: input.projectId,
          taskId: input.taskId,
          serviceId: input.serviceId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          policyVersionId: policyRecord.id,
          approvalId: approvalValid ? approval!.id : null,
        },
      });
      if (approvalValid) {
        await tx.approval.update({
          where: { id: approval!.id },
          data: { state: "CONSUMED", consumedAt: now },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorType: "SYSTEM",
          eventType: "SUPPLIER_SPEND_RESERVED",
          projectId: input.projectId,
          metadataJson: {
            reservationId: reservation.id,
            policyVersionId: policyRecord.id,
            paymentId: payment!.id,
            serviceId: input.serviceId,
            amountMinor: input.amountMinor.toString(),
            currency: input.currency,
            marketplaceFundingObservedAt: funding.observedAt.toISOString(),
          },
        },
      });
      return { kind: "RESERVED" as const, reservationId: reservation.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
