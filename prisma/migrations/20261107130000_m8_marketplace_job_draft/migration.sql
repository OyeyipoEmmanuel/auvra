ALTER TABLE "SupplierJob"
  ADD COLUMN "externalAgentId" UUID,
  ADD COLUMN "externalDraftId" UUID,
  ADD COLUMN "approvalUrl" TEXT,
  ADD COLUMN "listingSnapshotJson" JSONB,
  ADD COLUMN "providerStatusJson" JSONB,
  ADD COLUMN "autoAcceptAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SupplierJob_externalDraftId_key" ON "SupplierJob"("externalDraftId");
CREATE INDEX "SupplierJob_autoAcceptAt_state_idx" ON "SupplierJob"("autoAcceptAt", "state");
