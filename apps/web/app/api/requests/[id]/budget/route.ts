import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { isManagerAnalysis } from "@/lib/manager-analysis";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const user = await getApiUser();
  if (!user) return failure("UNAUTHENTICATED", "Sign in is required.", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { budgetMinor?: unknown } | null;
  if (typeof body?.budgetMinor !== "string" || !/^[1-9]\d{0,17}$/.test(body.budgetMinor)) {
    return failure("INVALID_BUDGET", "Enter a valid amount greater than zero.", 400);
  }
  const newBudget = BigInt(body.budgetMinor);

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.serviceRequest.findFirst({
      where: { id, customerId: user.id },
      select: {
        state: true,
        version: true,
        budgetMinor: true,
        budgetCurrency: true,
        analysisJson: true,
        project: { select: { id: true } },
      },
    });
    if (!current) return "NOT_FOUND" as const;
    if (
      !["SCOPED", "QUOTED"].includes(current.state) ||
      current.project ||
      current.budgetMinor === null ||
      !current.budgetCurrency
    ) {
      return "INVALID_STATE" as const;
    }
    if (newBudget <= current.budgetMinor) return "NOT_AN_INCREASE" as const;
    const analysis = current.analysisJson;
    if (!isManagerAnalysis(analysis) || !analysis.plan) {
      return "INVALID_STATE" as const;
    }

    const plan = analysis.plan;
    const discovery = analysis.discovery;
    const newDiscovery =
      current.state === "SCOPED"
        ? undefined
        : discovery?.status === "OVER_BUDGET" && discovery.quotedTotalMinor
          ? newBudget >= BigInt(discovery.quotedTotalMinor)
            ? {
                ...discovery,
                status: "READY_FOR_QUOTE" as const,
                explanation:
                  "Your increased budget now covers the presented quote. Review its scope, price, and expiry before accepting; supplier availability is still not reserved.",
              }
            : {
                ...discovery,
                explanation: `The presented quote is ${formatMinor(BigInt(discovery.quotedTotalMinor), discovery.quotedCurrency ?? current.budgetCurrency)}. Your new budget is ${formatMinor(newBudget, current.budgetCurrency)}. You can increase it again or explicitly accept the higher quote. Neither action spends money or hires an agent.`,
              }
          : discovery;
    const updatedAnalysis = {
      ...analysis,
      discovery: newDiscovery,
      plan: {
        ...plan,
        assumptions: plan.assumptions.map((assumption) =>
          assumption.startsWith("Customer budget ceiling:")
            ? `Customer budget ceiling: ${formatMinor(newBudget, current.budgetCurrency!)}.`
            : assumption,
        ),
        tasks: plan.tasks.map((task) => ({
          ...task,
          spendCapMinor: newBudget.toString(),
        })),
      },
    };

    const updated = await tx.serviceRequest.updateMany({
      where: { id, customerId: user.id, state: current.state, version: current.version },
      data: {
        budgetMinor: newBudget,
        analysisJson: JSON.parse(JSON.stringify(updatedAnalysis)),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return "CONFLICT" as const;

    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorId: user.id,
        requestId: id,
        eventType: "REQUEST_BUDGET_INCREASED",
        metadataJson: {
          previousBudgetMinor: current.budgetMinor.toString(),
          newBudgetMinor: newBudget.toString(),
          currency: current.budgetCurrency,
          quoteUnchanged: current.state === "QUOTED",
        },
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "ServiceRequest",
        aggregateId: id,
        eventType: "request.budget_increased",
        idempotencyKey: `request:${id}:budget-increased:v${current.version + 1}`,
        payloadJson: { requestId: id, version: current.version + 1 },
      },
    });
    return current.state === "SCOPED" ? ("REDISCOVER" as const) : ("SAVED" as const);
  });

  if (result === "NOT_FOUND") return failure("NOT_FOUND", "Request not found.", 404);
  if (result === "INVALID_STATE")
    return failure("INVALID_STATE", "This budget can no longer be changed.", 409);
  if (result === "NOT_AN_INCREASE")
    return failure("NOT_AN_INCREASE", "Enter an amount above your current budget.", 400);
  if (result === "CONFLICT")
    return failure("CONFLICT", "The request changed. Refresh and try again.", 409);
  return NextResponse.json({ saved: true, rediscover: result === "REDISCOVER" });
}

function formatMinor(value: bigint, currency: string) {
  const padded = value.toString().padStart(3, "0");
  return `${currency} ${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
