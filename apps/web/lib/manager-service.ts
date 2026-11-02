import "server-only";

import type { Prisma } from "@prisma/client";

import { analyzeServiceRequest, isManagerAnalysis } from "@/lib/manager-analysis";
import { prisma } from "@/lib/prisma";

export async function runManagerAnalysis(requestId: string, customerId: string) {
  const claimed = await prisma.$transaction(async (tx) => {
    const current = await tx.serviceRequest.findFirst({
      where: { id: requestId, customerId },
      select: { state: true, analysisJson: true },
    });
    if (!current) return { kind: "NOT_FOUND" as const };
    if (["SCOPED", "UNSUPPORTED", "REJECTED", "CANCELLED", "EXPIRED"].includes(current.state)) {
      return { kind: "COMPLETE" as const, state: current.state, analysis: current.analysisJson };
    }
    if (current.state === "NEEDS_CLARIFICATION") {
      return { kind: "WAITING" as const, state: current.state, analysis: current.analysisJson };
    }
    if (current.state === "SUBMITTED") {
      const update = await tx.serviceRequest.updateMany({
        where: { id: requestId, customerId, state: "SUBMITTED" },
        data: { state: "ANALYZING" },
      });
      if (update.count === 1) {
        await tx.auditEvent.create({ data: { actorType: "SYSTEM", eventType: "REQUEST_ANALYSIS_STARTED", requestId, metadataJson: { engine: "AUVRA_RULES_V1" } } });
        await tx.outboxEvent.create({ data: { aggregateType: "ServiceRequest", aggregateId: requestId, eventType: "request.analysis_started", idempotencyKey: `request:${requestId}:analysis-started:v1`, payloadJson: { requestId } } }).catch(() => undefined);
      }
    } else if (current.state !== "ANALYZING") {
      return { kind: "INVALID_STATE" as const, state: current.state };
    }
    return { kind: "CLAIMED" as const };
  });

  if (claimed.kind !== "CLAIMED") return claimed;

  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, customerId, state: "ANALYZING" },
    select: {
      rawBrief: true,
      desiredOutcome: true,
      constraintsJson: true,
      budgetMinor: true,
      budgetCurrency: true,
      deadline: true,
      answers: { orderBy: [{ round: "asc" }, { createdAt: "asc" }], select: { questionId: true, question: true, answer: true, round: true } },
    },
  });
  if (!request) return { kind: "IN_PROGRESS" as const };

  const constraints = Array.isArray(request.constraintsJson)
    ? request.constraintsJson.filter((item): item is string => typeof item === "string")
    : [];
  const analysis = analyzeServiceRequest({ ...request, constraints });
  const nextState = analysis.decision;
  const analysisJson = JSON.parse(JSON.stringify(analysis)) as Prisma.InputJsonValue;

  const saved = await prisma.$transaction(async (tx) => {
    const update = await tx.serviceRequest.updateMany({
      where: { id: requestId, customerId, state: "ANALYZING" },
      data: { state: nextState, analysisJson, version: { increment: 1 } },
    });
    if (update.count !== 1) return false;

    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        eventType: `REQUEST_${nextState}`,
        requestId,
        reason: analysis.decisionReason,
        metadataJson: { engine: analysis.engine, round: analysis.round, category: analysis.category },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "ServiceRequest",
        aggregateId: requestId,
        eventType: `request.${nextState.toLowerCase()}`,
        idempotencyKey: `request:${requestId}:analysis:${analysis.round}:${nextState.toLowerCase()}`,
        payloadJson: { requestId, round: analysis.round, category: analysis.category },
      },
    });
    await tx.notification.create({
      data: {
        userId: customerId,
        type: nextState === "NEEDS_CLARIFICATION" ? "CLARIFICATION_NEEDED" : nextState === "SCOPED" ? "REQUEST_SCOPED" : "REQUEST_UNSUPPORTED",
        title: nextState === "NEEDS_CLARIFICATION" ? "Auvra needs a few details" : nextState === "SCOPED" ? "Your initial plan is ready" : "Auvra cannot fulfill this request",
        body: analysis.decisionReason,
      },
    });
    return true;
  });

  return saved
    ? { kind: "COMPLETE" as const, state: nextState, analysis }
    : { kind: "IN_PROGRESS" as const };
}

export async function saveClarificationAnswers(requestId: string, customerId: string, rawAnswers: unknown) {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, customerId },
    select: { state: true, analysisJson: true },
  });
  if (!request) return { kind: "NOT_FOUND" as const };
  if (request.state !== "NEEDS_CLARIFICATION" || !isManagerAnalysis(request.analysisJson)) {
    return { kind: "INVALID_STATE" as const, state: request.state };
  }
  const analysis = request.analysisJson;
  if (!Array.isArray(rawAnswers)) return { kind: "INVALID_ANSWERS" as const };

  const supplied = new Map<string, string>();
  for (const item of rawAnswers) {
    if (!item || typeof item !== "object") return { kind: "INVALID_ANSWERS" as const };
    const record = item as Record<string, unknown>;
    if (typeof record.questionId !== "string" || typeof record.answer !== "string") return { kind: "INVALID_ANSWERS" as const };
    const answer = record.answer.trim();
    if (!answer || answer.length > 2000) return { kind: "INVALID_ANSWERS" as const };
    supplied.set(record.questionId, answer);
  }

  if (analysis.questions.some((question) => !supplied.has(question.id))) {
    return { kind: "INCOMPLETE_ANSWERS" as const };
  }

  const moved = await prisma.$transaction(async (tx) => {
    const update = await tx.serviceRequest.updateMany({
      where: { id: requestId, customerId, state: "NEEDS_CLARIFICATION" },
      data: { state: "ANALYZING" },
    });
    if (update.count !== 1) return false;

    await tx.requestAnswer.createMany({
      data: analysis.questions.map((question) => ({
        requestId,
        round: analysis.round,
        questionId: question.id,
        question: question.prompt,
        answer: supplied.get(question.id)!,
      })),
      skipDuplicates: true,
    });
    await tx.auditEvent.create({ data: { actorType: "USER", actorId: customerId, eventType: "REQUEST_CLARIFICATIONS_ANSWERED", requestId, metadataJson: { round: analysis.round, answerCount: supplied.size } } });
    await tx.outboxEvent.create({ data: { aggregateType: "ServiceRequest", aggregateId: requestId, eventType: "request.clarifications_answered", idempotencyKey: `request:${requestId}:clarifications:${analysis.round}`, payloadJson: { requestId, round: analysis.round } } });
    return true;
  });

  if (!moved) return { kind: "IN_PROGRESS" as const };
  return runManagerAnalysis(requestId, customerId);
}
