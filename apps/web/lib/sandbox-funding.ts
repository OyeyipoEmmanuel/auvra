import "server-only";

import { Prisma } from "@prisma/client";

import { isManagerAnalysis } from "@/lib/manager-analysis";
import { prisma } from "@/lib/prisma";

const demoAsset = "DEMO_USDC";

export async function fundAcceptedQuoteInSandbox(quoteId: string, customerId: string) {
  if (process.env.AUVRA_RUNTIME_MODE !== "DEMO_SANDBOX" || process.env.MARKETPLACE_WRITES_ENABLED === "true") {
    return { kind: "DISABLED" as const };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, request: { customerId } },
    include: { request: { select: { id: true, state: true, analysisJson: true, deadline: true, project: { select: { id: true } } } } },
  });
  if (!quote) return { kind: "NOT_FOUND" as const };
  if (quote.request.project) return { kind: "ALREADY_FUNDED" as const, projectId: quote.request.project.id };
  if (quote.state !== "ACCEPTED" || quote.request.state !== "APPROVED") return { kind: "INVALID_STATE" as const };
  if (quote.currency !== "USDC" || quote.customerTotalMinor <= BigInt(0)) return { kind: "INVALID_QUOTE" as const };

  const analysis = quote.request.analysisJson;
  if (!isManagerAnalysis(analysis) || !analysis.plan || analysis.discovery?.status !== "READY_FOR_QUOTE" || analysis.discovery.quoteId !== quote.id) {
    return { kind: "INVALID_QUOTE" as const };
  }
  const tasks = analysis.plan.tasks;
  const selected = analysis.discovery.selected;
  if (tasks.length === 0 || tasks.length !== selected.length || new Set(selected.map((entry) => entry.taskKey)).size !== tasks.length) return { kind: "INVALID_QUOTE" as const };
  const selectedByKey = new Map(selected.map((entry) => [entry.taskKey, entry]));
  let selectedCost = BigInt(0);
  for (const task of tasks) {
    const choice = selectedByKey.get(task.key);
    if (!choice || choice.currency !== "USDC" || !/^\d+$/.test(choice.priceMinor)) return { kind: "INVALID_QUOTE" as const };
    selectedCost += BigInt(choice.priceMinor);
    if (task.dependencies.some((dependency) => !tasks.some((candidate) => candidate.key === dependency))) return { kind: "INVALID_QUOTE" as const };
  }
  if (selectedCost !== quote.executionCostMinor || quote.executionCostMinor + quote.reserveMinor + quote.feeMinor !== quote.customerTotalMinor || quote.supplierCapMinor !== quote.executionCostMinor + quote.reserveMinor) {
    return { kind: "INVALID_QUOTE" as const };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const moved = await tx.serviceRequest.updateMany({ where: { id: quote.request.id, customerId, state: "APPROVED" }, data: { state: "AWAITING_FUNDS", version: { increment: 1 } } });
      if (moved.count !== 1) return { kind: "CONFLICT" as const };

      const project = await tx.project.create({ data: { requestId: quote.request.id, customerId, state: "PLANNING" }, select: { id: true } });
      const payment = await tx.customerPayment.create({ data: {
        customerId, quoteId, projectId: project.id, provider: "DEMO_SANDBOX", providerReference: `demo:${quoteId}`,
        state: "ALLOCATED", currency: demoAsset, amountMinor: quote.customerTotalMinor,
        verifiedAt: new Date(), allocatedAt: new Date(),
      }, select: { id: true } });

      const accountSpecs = [
        { code: "DEMO_CASH", name: "Simulated customer funds", accountType: "ASSET" },
        { code: "CUSTOMER_OBLIGATION", name: "Customer delivery obligation", accountType: "LIABILITY" },
        { code: "PROJECT_RESERVE", name: "Reserved supplier capacity", accountType: "LIABILITY" },
      ];
      const accounts = await Promise.all(accountSpecs.map((account) => tx.ledgerAccount.upsert({
        where: { code_asset: { code: account.code, asset: demoAsset } },
        create: { ...account, asset: demoAsset }, update: {}, select: { id: true, code: true },
      })));
      const ids = Object.fromEntries(accounts.map((account) => [account.code, account.id]));
      const collection = await tx.ledgerTransaction.create({ data: {
        transactionType: "DEMO_CUSTOMER_COLLECTION", asset: demoAsset, externalReference: `demo:${quoteId}`,
        projectId: project.id, paymentId: payment.id, metadataJson: { quoteId, simulated: true },
      }, select: { id: true } });
      const reserve = await tx.ledgerTransaction.create({ data: {
        transactionType: "DEMO_PROJECT_RESERVE", asset: demoAsset, externalReference: `demo:reserve:${quoteId}`,
        projectId: project.id, paymentId: payment.id, metadataJson: { quoteId, simulated: true },
      }, select: { id: true } });
      await tx.ledgerEntry.createMany({ data: [
        { transactionId: collection.id, accountId: ids.DEMO_CASH!, side: "DEBIT", amountMinor: quote.customerTotalMinor },
        { transactionId: collection.id, accountId: ids.CUSTOMER_OBLIGATION!, side: "CREDIT", amountMinor: quote.customerTotalMinor },
        { transactionId: reserve.id, accountId: ids.CUSTOMER_OBLIGATION!, side: "DEBIT", amountMinor: quote.supplierCapMinor },
        { transactionId: reserve.id, accountId: ids.PROJECT_RESERVE!, side: "CREDIT", amountMinor: quote.supplierCapMinor },
      ] });

      await tx.projectTask.createMany({ data: tasks.map((task) => ({
        projectId: project.id, taskKey: task.key, title: task.title, objective: task.objective,
        inputContractJson: { requestId: quote.request.id }, outputContractJson: { deliverables: task.deliverables },
        dependenciesJson: task.dependencies, capabilitiesJson: task.capabilities, validationRulesJson: task.acceptanceCriteria,
        status: "PLANNED", budgetMinor: BigInt(selectedByKey.get(task.key)!.priceMinor), budgetCurrency: "USDC",
        deadline: quote.request.deadline,
      })) });

      await tx.serviceRequest.update({ where: { id: quote.request.id }, data: { state: "FUNDED", version: { increment: 1 } } });
      await tx.serviceRequest.update({ where: { id: quote.request.id }, data: { state: "PROJECT_CREATED", version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorType: "USER", actorId: customerId, eventType: "DEMO_FUNDING_APPROVED", requestId: quote.request.id, projectId: project.id, paymentId: payment.id, metadataJson: { quoteId, asset: demoAsset, amountMinor: quote.customerTotalMinor.toString(), simulated: true } } });
      await tx.outboxEvent.create({ data: { aggregateType: "Project", aggregateId: project.id, eventType: "project.created_with_demo_funding", idempotencyKey: `project:${project.id}:demo-funded`, payloadJson: { projectId: project.id, requestId: quote.request.id, quoteId, simulated: true } } });
      await tx.notification.create({ data: { userId: customerId, type: "DEMO_PROJECT_CREATED", title: "Demo project created", body: "Sandbox funding was recorded. No real tokens moved and no supplier was hired." } });
      return { kind: "FUNDED" as const, projectId: project.id, paymentId: payment.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return { kind: "CONFLICT" as const };
    throw error;
  }
}
