CREATE TYPE "ExternalActionState" AS ENUM (
  'PREPARED', 'IN_FLIGHT', 'UNKNOWN', 'CONFIRMED', 'REVIEW_REQUIRED'
);

CREATE TABLE "ExternalAction" (
  "id" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" "ExternalActionState" NOT NULL DEFAULT 'PREPARED',
  "externalId" TEXT,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalAction_idempotencyKey_key" ON "ExternalAction"("idempotencyKey");
CREATE INDEX "ExternalAction_state_leaseExpiresAt_idx"
  ON "ExternalAction"("state", "leaseExpiresAt");
