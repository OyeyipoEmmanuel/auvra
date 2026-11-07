ALTER TABLE "OutboxEvent"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "OutboxEvent_state_leaseExpiresAt_idx"
  ON "OutboxEvent"("state", "leaseExpiresAt");
