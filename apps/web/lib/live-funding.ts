import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { isManagerAnalysis } from "@/lib/manager-analysis";
import { assertBalancedJournal } from "@/lib/ledger";
import {
  bachsApiBase,
  bachsReturnUrls,
  isBachsCheckoutUrl,
  matchesBachsPayment,
  retrieveBachsPayment,
  usdDecimalToMinor,
  usdMinorToDecimal,
} from "@/lib/bachs";
import { bachsPaymentMode } from "@/lib/payment-config";
import { prisma } from "@/lib/prisma";

type BachsEvent = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

function bachsEvent(payload: unknown): BachsEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const event = payload as Record<string, unknown>;
  return typeof event.id === "string" &&
    event.id.startsWith("evt_") &&
    typeof event.type === "string" &&
    event.data &&
    typeof event.data === "object" &&
    !Array.isArray(event.data)
    ? (event as BachsEvent)
    : null;
}

export async function createBachsCheckout(quoteId: string, customerId: string) {
  const mode = bachsPaymentMode();
  const secret = process.env.BACHS_API_KEY;
  if (!mode || !secret) return { kind: "DISABLED" as const };
  const provider = mode === "SANDBOX" ? "BACHS_SANDBOX" : "BACHS";

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, request: { customerId } },
    include: {
      request: {
        include: { customer: { select: { email: true } }, project: { select: { id: true } } },
      },
    },
  });
  if (!quote) return { kind: "NOT_FOUND" as const };
  // Never charge USD against an existing USDC quote.
  if (
    quote.state !== "ACCEPTED" ||
    quote.request.state !== "APPROVED" ||
    quote.currency !== "USD" ||
    quote.decimals !== 2 ||
    quote.customerTotalMinor <= BigInt(0) ||
    quote.customerTotalMinor > BigInt(Number.MAX_SAFE_INTEGER) ||
    quote.request.project !== null ||
    !quote.request.customer.email
  )
    return { kind: "INELIGIBLE_QUOTE" as const };

  const reference = quote.id;
  const existing = await prisma.customerPayment.findUnique({
    where: { provider_providerReference: { provider, providerReference: reference } },
  });
  if (existing && existing.state !== "CREATED" && existing.state !== "PENDING")
    return { kind: "ALREADY_PROCESSED" as const };
  if (existing?.state === "PENDING" && existing.checkoutUrl && existing.providerCheckoutId) {
    const check = await fetch(
      `${bachsApiBase(mode)}/v1/checkout-sessions/${encodeURIComponent(existing.providerCheckoutId)}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
    );
    if (!check.ok) throw new Error(`Bachs checkout lookup failed: ${check.status}`);
    const session: unknown = await check.json();
    if (
      !session ||
      typeof session !== "object" ||
      !("status" in session) ||
      session.status !== "open"
    )
      return { kind: "CHECKOUT_EXPIRED" as const };
    return { kind: "CHECKOUT_READY" as const, authorizationUrl: existing.checkoutUrl, mode };
  }
  await prisma.customerPayment.upsert({
    where: { provider_providerReference: { provider, providerReference: reference } },
    create: {
      customerId,
      quoteId,
      provider,
      providerReference: reference,
      currency: "USD",
      amountMinor: quote.customerTotalMinor,
      state: "CREATED",
    },
    update: {},
  });
  const response = await fetch(`${bachsApiBase(mode)}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `auvra-checkout-${quote.id}`,
    },
    body: JSON.stringify({
      pricing: { currency: "USD", amount: usdMinorToDecimal(quote.customerTotalMinor) },
      billing_currency: "USD",
      payment_method_types: ["USD_CARD"],
      customer: { email: quote.request.customer.email },
      reference,
      metadata: { auvra_quote_id: quote.id },
      ...bachsReturnUrls(quote.id, quote.requestId),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Bachs checkout initialization failed: ${response.status}`);
  const result: unknown = await response.json();
  if (!isCheckoutResponse(result, mode, reference))
    throw new Error("Invalid Bachs checkout response.");
  const updated = await prisma.customerPayment.updateMany({
    where: { provider, providerReference: reference, state: "CREATED" },
    data: {
      state: "PENDING",
      checkoutUrl: result.checkout_url,
      providerCheckoutId: result.checkout_id,
    },
  });
  if (updated.count !== 1) {
    const current = await prisma.customerPayment.findUnique({
      where: { provider_providerReference: { provider, providerReference: reference } },
    });
    if (current?.state === "PENDING" && current.checkoutUrl && current.providerCheckoutId)
      return { kind: "CHECKOUT_READY" as const, authorizationUrl: current.checkoutUrl, mode };
    return { kind: "ALREADY_PROCESSED" as const };
  }
  return { kind: "CHECKOUT_READY" as const, authorizationUrl: result.checkout_url, mode };
}

function isCheckoutResponse(
  value: unknown,
  mode: "SANDBOX" | "LIVE",
  reference: string,
): value is { status: "open"; checkout_id: string; checkout_url: string; reference: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "status" in value &&
    value.status === "open" &&
    "reference" in value &&
    value.reference === reference &&
    "checkout_id" in value &&
    typeof value.checkout_id === "string" &&
    value.checkout_id.startsWith("chk_") &&
    "checkout_url" in value &&
    typeof value.checkout_url === "string" &&
    isBachsCheckoutUrl(value.checkout_url, mode),
  );
}

/** Recover a completed checkout without trusting a browser redirect or creating another charge. */
export async function reconcileBachsCheckout(quoteId: string, customerId: string) {
  const mode = bachsPaymentMode();
  const secret = process.env.BACHS_API_KEY;
  if (!mode || !secret) return { kind: "DISABLED" as const };
  const provider = mode === "SANDBOX" ? "BACHS_SANDBOX" : "BACHS";
  const payment = await prisma.customerPayment.findFirst({
    where: { quoteId, customerId, provider },
  });
  if (!payment) return { kind: "NOT_FOUND" as const };
  if (payment.projectId && ["ALLOCATED", "RECONCILED"].includes(payment.state)) {
    return { kind: "ALREADY_VERIFIED" as const, projectId: payment.projectId };
  }
  if (payment.state !== "PENDING" || !payment.providerCheckoutId) {
    return { kind: "INVALID_STATE" as const };
  }

  const response = await fetch(
    `${bachsApiBase(mode)}/v1/checkout-sessions/${encodeURIComponent(payment.providerCheckoutId)}`,
    { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Bachs checkout lookup failed: ${response.status}`);
  const session: unknown = await response.json();
  const confirmed = completedBachsCheckout(session, {
    reference: quoteId,
    checkoutId: payment.providerCheckoutId,
    amountMinor: payment.amountMinor,
  });
  if (!confirmed) return { kind: "PAYMENT_NOT_CONFIRMED" as const };

  return verifyAndAllocateBachsPayment({
    reference: quoteId,
    checkoutId: payment.providerCheckoutId,
    chargeId: confirmed.chargeId,
    amountMinor: payment.amountMinor,
    expectedCustomerId: customerId,
    evidence: { kind: "PROVIDER_RECONCILIATION" },
  });
}

function completedBachsCheckout(
  value: unknown,
  expected: { reference: string; checkoutId: string; amountMinor: bigint },
): { chargeId: string } | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Record<string, unknown>;
  if (!session.charge || typeof session.charge !== "object") return null;
  const charge = session.charge as Record<string, unknown>;
  const chargeId = charge.payment_id;
  if (
    session.status !== "completed" ||
    !["paid", "succeeded"].includes(String(session.payment_status)) ||
    session.checkout_id !== expected.checkoutId ||
    session.reference !== expected.reference ||
    session.currency !== "USD" ||
    typeof session.amount !== "string" ||
    usdDecimalToMinor(session.amount) !== expected.amountMinor ||
    typeof chargeId !== "string" ||
    !chargeId.startsWith("ch_") ||
    charge.status !== "succeeded" ||
    charge.checkout_id !== expected.checkoutId ||
    charge.reference !== expected.reference ||
    charge.currency !== "USD" ||
    typeof charge.amount !== "string" ||
    typeof charge.amount_paid !== "string" ||
    usdDecimalToMinor(charge.amount) !== expected.amountMinor ||
    usdDecimalToMinor(charge.amount_paid) !== expected.amountMinor
  ) {
    return null;
  }
  return { chargeId };
}

type PaymentEvidence =
  | { kind: "SIGNED_WEBHOOK"; eventId: string; eventType: string; bodyHash: string }
  | { kind: "PROVIDER_RECONCILIATION" };

export async function processBachsCollection(rawBody: string, payload: unknown) {
  const event = bachsEvent(payload);
  if (!event || event.type !== "collection.succeeded") return { kind: "IGNORED" as const };
  const {
    reference,
    checkout_id: checkoutId,
    charge_id: chargeId,
    amount,
    currency,
    status,
  } = event.data;
  if (typeof chargeId !== "string" || !chargeId.startsWith("ch_"))
    return { kind: "TEST_EVENT" as const };
  if (
    typeof reference !== "string" ||
    typeof checkoutId !== "string" ||
    typeof amount !== "string" ||
    currency !== "USD" ||
    status !== "SUCCEEDED"
  )
    return { kind: "VERIFICATION_MISMATCH" as const };
  const amountMinor = usdDecimalToMinor(amount);
  if (amountMinor === null) return { kind: "VERIFICATION_MISMATCH" as const };

  return verifyAndAllocateBachsPayment({
    reference,
    checkoutId,
    chargeId,
    amountMinor,
    evidence: {
      kind: "SIGNED_WEBHOOK",
      eventId: event.id,
      eventType: event.type,
      bodyHash: createHash("sha256").update(rawBody).digest("hex"),
    },
  });
}

async function verifyAndAllocateBachsPayment({
  reference,
  checkoutId,
  chargeId,
  amountMinor,
  evidence,
  expectedCustomerId,
}: {
  reference: string;
  checkoutId: string;
  chargeId: string;
  amountMinor: bigint;
  evidence: PaymentEvidence;
  expectedCustomerId?: string;
}) {
  const mode = bachsPaymentMode();
  const secret = process.env.BACHS_API_KEY;
  if (!mode || !secret) throw new Error("Bachs credentials are required.");
  const provider = mode === "SANDBOX" ? "BACHS_SANDBOX" : "BACHS";
  const ledgerAsset = mode === "SANDBOX" ? "DEMO_USD" : "USD";
  const payment = await prisma.customerPayment.findUnique({
    where: { provider_providerReference: { provider, providerReference: reference } },
    include: { quote: { include: { request: true } } },
  });
  if (!payment) return { kind: "UNKNOWN_REFERENCE" as const };
  if (expectedCustomerId && payment.customerId !== expectedCustomerId)
    return { kind: "UNKNOWN_REFERENCE" as const };
  if (payment.providerCheckoutId !== checkoutId || amountMinor !== payment.amountMinor)
    return { kind: "VERIFICATION_MISMATCH" as const };
  const verification = await retrieveBachsPayment(chargeId, mode, secret);
  if (
    !matchesBachsPayment(verification, {
      reference,
      checkoutId,
      chargeId,
      amountMinor: payment.amountMinor,
    })
  )
    return { kind: "VERIFICATION_MISMATCH" as const };
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8431189202)`;
      if (evidence.kind === "SIGNED_WEBHOOK") {
        const replay = await tx.providerWebhookEvent.findUnique({
          where: { provider_eventKey: { provider, eventKey: evidence.eventId } },
        });
        if (replay) return { kind: "REPLAY" as const };
      }
      const current = await tx.customerPayment.findUniqueOrThrow({ where: { id: payment.id } });
      if (["REFUNDED", "DISPUTED", "REFUND_PENDING"].includes(current.state))
        return { kind: "LATE_EVENT" as const };
      if (["ALLOCATED", "RECONCILED", "VERIFIED"].includes(current.state))
        return { kind: "ALREADY_VERIFIED" as const, projectId: current.projectId };
      if (
        payment.quote.state !== "ACCEPTED" ||
        payment.quote.request.state !== "APPROVED" ||
        payment.quote.currency !== "USD" ||
        payment.quote.decimals !== 2
      )
        return { kind: "INELIGIBLE_QUOTE" as const };
      const analysis = payment.quote.request.analysisJson;
      if (
        !isManagerAnalysis(analysis) ||
        !analysis.plan ||
        analysis.discovery?.quoteId !== payment.quoteId
      )
        return { kind: "INVALID_PLAN" as const };

      const tasks = analysis.plan.tasks;
      const selected = analysis.discovery?.selected ?? [];
      const selectedByKey = new Map(selected.map((entry) => [entry.taskKey, entry]));
      if (
        tasks.length === 0 ||
        tasks.length !== selected.length ||
        tasks.some((task) => !selectedByKey.has(task.key)) ||
        selected.some((entry) => entry.currency !== "USD" || !/^\d+$/.test(entry.priceMinor)) ||
        selected.reduce((sum, entry) => sum + BigInt(entry.priceMinor), BigInt(0)) !==
          payment.quote.executionCostMinor
      )
        return { kind: "INVALID_PLAN" as const };

      const project = await tx.project.create({
        data: {
          requestId: payment.quote.requestId,
          customerId: payment.customerId,
          state: "PLANNING",
        },
      });
      await tx.projectTask.createMany({
        data: tasks.map((task) => ({
          projectId: project.id,
          taskKey: task.key,
          title: task.title,
          objective: task.objective,
          inputContractJson: { requestId: payment.quote.requestId },
          outputContractJson: { deliverables: task.deliverables },
          dependenciesJson: task.dependencies,
          capabilitiesJson: task.capabilities,
          validationRulesJson: task.acceptanceCriteria,
          status: "PLANNED",
          budgetMinor: BigInt(selectedByKey.get(task.key)!.priceMinor),
          budgetCurrency: "USD",
          deadline: payment.quote.request.deadline,
        })),
      });
      await tx.customerPayment.update({
        where: { id: payment.id },
        data: {
          state: "ALLOCATED",
          projectId: project.id,
          providerChargeId: chargeId,
          verifiedAt: new Date(),
          allocatedAt: new Date(),
        },
      });
      const cash = await tx.ledgerAccount.upsert({
        where: {
          code_asset: {
            code: mode === "SANDBOX" ? "BACHS_SANDBOX_RECEIVABLE" : "BACHS_RECEIVABLE",
            asset: ledgerAsset,
          },
        },
        create: {
          code: mode === "SANDBOX" ? "BACHS_SANDBOX_RECEIVABLE" : "BACHS_RECEIVABLE",
          asset: ledgerAsset,
          name:
            mode === "SANDBOX"
              ? "Bachs simulated customer receivable"
              : "Bachs customer receivable",
          accountType: "ASSET",
        },
        update: {},
      });
      const obligation = await tx.ledgerAccount.upsert({
        where: { code_asset: { code: "CUSTOMER_OBLIGATION", asset: ledgerAsset } },
        create: {
          code: "CUSTOMER_OBLIGATION",
          asset: ledgerAsset,
          name: "Customer delivery obligation",
          accountType: "LIABILITY",
        },
        update: {},
      });
      const reserve = await tx.ledgerAccount.upsert({
        where: { code_asset: { code: "PROJECT_RESERVE", asset: ledgerAsset } },
        create: {
          code: "PROJECT_RESERVE",
          asset: ledgerAsset,
          name: "Reserved supplier budget",
          accountType: "LIABILITY",
        },
        update: {},
      });
      const journal = await tx.ledgerTransaction.create({
        data: {
          transactionType: mode === "SANDBOX" ? "DEMO_CUSTOMER_COLLECTION" : "CUSTOMER_COLLECTION",
          asset: ledgerAsset,
          externalReference: reference,
          projectId: project.id,
          paymentId: payment.id,
          metadataJson: {
            quoteId: payment.quoteId,
            provider,
            verifiedByProviderApi: true,
            simulated: mode === "SANDBOX",
            checkoutId,
            chargeId,
          },
        },
      });
      const collectionLines = [
        {
          transactionId: journal.id,
          accountId: cash.id,
          side: "DEBIT",
          amountMinor: payment.amountMinor,
        },
        {
          transactionId: journal.id,
          accountId: obligation.id,
          side: "CREDIT",
          amountMinor: payment.amountMinor,
        },
      ] as const;
      assertBalancedJournal(collectionLines);
      await tx.ledgerEntry.createMany({ data: [...collectionLines] });
      const reserveJournal = await tx.ledgerTransaction.create({
        data: {
          transactionType: mode === "SANDBOX" ? "DEMO_PROJECT_RESERVE" : "PROJECT_RESERVE",
          asset: ledgerAsset,
          externalReference: `reserve:${reference}`,
          projectId: project.id,
          paymentId: payment.id,
          metadataJson: {
            quoteId: payment.quoteId,
            supplierCapMinor: payment.quote.supplierCapMinor.toString(),
          },
        },
      });
      const reserveLines = [
        {
          transactionId: reserveJournal.id,
          accountId: obligation.id,
          side: "DEBIT",
          amountMinor: payment.quote.supplierCapMinor,
        },
        {
          transactionId: reserveJournal.id,
          accountId: reserve.id,
          side: "CREDIT",
          amountMinor: payment.quote.supplierCapMinor,
        },
      ] as const;
      assertBalancedJournal(reserveLines);
      await tx.ledgerEntry.createMany({ data: [...reserveLines] });
      if (evidence.kind === "SIGNED_WEBHOOK") {
        await tx.providerWebhookEvent.create({
          data: {
            provider,
            eventKey: evidence.eventId,
            eventType: evidence.eventType,
            bodyHash: evidence.bodyHash,
            paymentId: payment.id,
            processedAt: new Date(),
          },
        });
      }
      await tx.serviceRequest.update({
        where: { id: payment.quote.requestId },
        data: { state: "PROJECT_CREATED", version: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          actorType: "SYSTEM",
          eventType:
            mode === "SANDBOX" ? "BACHS_SANDBOX_FUNDING_VERIFIED" : "LIVE_FUNDING_VERIFIED",
          requestId: payment.quote.requestId,
          projectId: project.id,
          paymentId: payment.id,
          metadataJson: {
            provider,
            reference,
            currency: "USD",
            amountMinor: payment.amountMinor.toString(),
            simulated: mode === "SANDBOX",
            verificationSource: evidence.kind,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "Project",
          aggregateId: project.id,
          eventType:
            mode === "SANDBOX"
              ? "project.created_with_bachs_sandbox"
              : "project.created_with_live_funding",
          idempotencyKey: `project:${project.id}:${mode === "SANDBOX" ? "sandbox" : "live"}-funded`,
          payloadJson: {
            projectId: project.id,
            quoteId: payment.quoteId,
            simulated: mode === "SANDBOX",
          },
        },
      });
      return { kind: "VERIFIED" as const, projectId: project.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Signed refund/dispute notices freeze procurement until provider reconciliation. */
export async function processBachsRiskEvent(rawBody: string, payload: unknown) {
  const event = bachsEvent(payload);
  if (
    !event ||
    !["refund.created", "refund.paid", "dispute.created", "dispute.updated"].includes(event.type)
  )
    return { kind: "IGNORED" as const };
  const chargeId = event.data.charge_id;
  if (typeof chargeId !== "string" || !chargeId.startsWith("ch_"))
    return { kind: "UNMATCHED_RISK_EVENT" as const };
  const mode = bachsPaymentMode();
  if (!mode) return { kind: "IGNORED" as const };
  const provider = mode === "SANDBOX" ? "BACHS_SANDBOX" : "BACHS";
  const payment = await prisma.customerPayment.findUnique({
    where: { provider_providerChargeId: { provider, providerChargeId: chargeId } },
  });
  if (!payment) return { kind: "UNMATCHED_RISK_EVENT" as const };
  const eventKey = event.id;
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8431189202)`;
      const seen = await tx.providerWebhookEvent.findUnique({
        where: { provider_eventKey: { provider, eventKey } },
      });
      if (seen) return { kind: "REPLAY" as const };
      await tx.customerPayment.update({
        where: { id: payment.id },
        data: {
          state: event.type.startsWith("dispute.")
            ? "DISPUTED"
            : event.type === "refund.paid"
              ? "REFUNDED"
              : "REFUND_PENDING",
        },
      });
      if (payment.projectId) {
        await tx.project.update({ where: { id: payment.projectId }, data: { state: "BLOCKED" } });
      }
      await tx.providerWebhookEvent.create({
        data: {
          provider,
          eventKey,
          eventType: event.type,
          bodyHash,
          paymentId: payment.id,
          processedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorType: "SYSTEM",
          eventType: "PAYMENT_RISK_HOLD",
          paymentId: payment.id,
          projectId: payment.projectId,
          metadataJson: { provider, chargeId, event: event.type },
        },
      });
      return { kind: "HELD" as const };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
