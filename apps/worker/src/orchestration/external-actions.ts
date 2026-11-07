import { Prisma, type PrismaClient } from "@prisma/client";

type ActionIdentity = {
  idempotencyKey: string;
  provider: string;
  actionType: string;
  requestHash: string;
};

function validIdentity(input: ActionIdentity): boolean {
  return (
    input.idempotencyKey.length > 0 &&
    input.idempotencyKey.length <= 200 &&
    input.provider.length > 0 &&
    input.actionType.length > 0 &&
    /^[0-9a-f]{64}$/.test(input.requestHash)
  );
}

/** Record the exact action before any external request. Replays must match byte-for-byte intent. */
export async function prepareExternalAction(db: PrismaClient, input: ActionIdentity) {
  if (!validIdentity(input)) throw new Error("Invalid external action identity.");
  try {
    const action = await db.externalAction.create({ data: input });
    return { kind: "PREPARED" as const, action };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const action = await db.externalAction.findUniqueOrThrow({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (
      action.provider !== input.provider ||
      action.actionType !== input.actionType ||
      action.requestHash !== input.requestHash
    ) {
      throw new Error("Conflicting external action replay.");
    }
    return { kind: "EXISTING" as const, action };
  }
}

/** Only a never-sent PREPARED action can be claimed for its first attempt. */
export async function claimExternalAction(
  db: PrismaClient,
  idempotencyKey: string,
  workerId: string,
  now = new Date(),
) {
  if (!idempotencyKey || !workerId) throw new Error("Invalid action claim.");
  const updated = await db.externalAction.updateMany({
    where: { idempotencyKey, state: "PREPARED", attemptCount: 0 },
    data: {
      state: "IN_FLIGHT",
      leaseOwner: workerId,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      attemptCount: { increment: 1 },
    },
  });
  return updated.count === 1 ? "CLAIMED" : "NOT_CLAIMED";
}

/** An expired network call becomes UNKNOWN, never automatically retryable. */
export async function markExternalActionTimedOut(
  db: PrismaClient,
  idempotencyKey: string,
  now = new Date(),
) {
  const updated = await db.externalAction.updateMany({
    where: {
      idempotencyKey,
      state: "IN_FLIGHT",
      leaseExpiresAt: { lte: now },
    },
    data: { state: "UNKNOWN", leaseOwner: null, leaseExpiresAt: null },
  });
  return updated.count === 1 ? "UNKNOWN" : "UNCHANGED";
}

/** Restart sweep: park expired in-flight actions for provider lookup, never re-arm them. */
export async function parkExpiredExternalActions(
  db: PrismaClient,
  now = new Date(),
  onlyIdempotencyKey?: string,
) {
  const expired = await db.externalAction.findMany({
    where: {
      state: "IN_FLIGHT",
      leaseExpiresAt: { lte: now },
      ...(onlyIdempotencyKey ? { idempotencyKey: onlyIdempotencyKey } : {}),
    },
    select: { id: true },
    take: 100,
    orderBy: { leaseExpiresAt: "asc" },
  });
  if (expired.length === 0) return 0;
  const updated = await db.externalAction.updateMany({
    where: {
      id: { in: expired.map((action) => action.id) },
      state: "IN_FLIGHT",
      leaseExpiresAt: { lte: now },
    },
    data: { state: "UNKNOWN", leaseOwner: null, leaseExpiresAt: null },
  });
  return updated.count;
}

/** Use only with an authenticated provider read that identifies the remote action. */
export async function confirmExternalActionFromProviderRead(
  db: PrismaClient,
  idempotencyKey: string,
  externalId: string,
) {
  if (!externalId.trim()) throw new Error("Provider external ID is required.");
  const updated = await db.externalAction.updateMany({
    where: { idempotencyKey, state: { in: ["IN_FLIGHT", "UNKNOWN"] } },
    data: {
      state: "CONFIRMED",
      externalId,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  return updated.count === 1 ? "CONFIRMED" : "UNCHANGED";
}

/** No provider proof means a human must review; M7 never re-arms an ambiguous action. */
export async function requireExternalActionReview(db: PrismaClient, idempotencyKey: string) {
  const updated = await db.externalAction.updateMany({
    where: { idempotencyKey, state: "UNKNOWN" },
    data: { state: "REVIEW_REQUIRED" },
  });
  return updated.count === 1 ? "REVIEW_REQUIRED" : "UNCHANGED";
}
