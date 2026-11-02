-- Supplier matching happens before funding and project creation, so matches
-- belong to a request plan task until a funded ProjectTask exists.
DROP INDEX "SupplierMatch_taskId_eligible_idx";
DROP INDEX "SupplierMatch_taskId_serviceObservationId_key";

ALTER TABLE "SupplierMatch"
  ALTER COLUMN "taskId" DROP NOT NULL,
  ADD COLUMN "requestId" UUID,
  ADD COLUMN "planTaskKey" TEXT;

ALTER TABLE "SupplierMatch"
  ALTER COLUMN "requestId" SET NOT NULL,
  ALTER COLUMN "planTaskKey" SET NOT NULL;

CREATE INDEX "SupplierMatch_requestId_planTaskKey_eligible_idx"
  ON "SupplierMatch"("requestId", "planTaskKey", "eligible");

CREATE UNIQUE INDEX "SupplierMatch_requestId_planTaskKey_serviceObserv_key"
  ON "SupplierMatch"("requestId", "planTaskKey", "serviceObservationId");

ALTER TABLE "SupplierMatch"
  ADD CONSTRAINT "SupplierMatch_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
