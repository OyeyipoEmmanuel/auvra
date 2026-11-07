CREATE TABLE "ProviderWebhookEvent" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "paymentId" UUID,
  "eventType" TEXT NOT NULL,
  "bodyHash" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_eventKey_key"
  ON "ProviderWebhookEvent"("provider", "eventKey");
CREATE INDEX "ProviderWebhookEvent_paymentId_verifiedAt_idx"
  ON "ProviderWebhookEvent"("paymentId", "verifiedAt");

CREATE TABLE "SpendReservation" (
  "id" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "projectId" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "policyVersionId" UUID NOT NULL,
  "approvalId" UUID,
  "serviceId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "SpendReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpendReservation_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE UNIQUE INDEX "SpendReservation_idempotencyKey_key"
  ON "SpendReservation"("idempotencyKey");
CREATE INDEX "SpendReservation_projectId_state_idx"
  ON "SpendReservation"("projectId", "state");
CREATE INDEX "SpendReservation_createdAt_state_idx"
  ON "SpendReservation"("createdAt", "state");
