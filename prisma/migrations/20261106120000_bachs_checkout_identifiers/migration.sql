ALTER TABLE "CustomerPayment" ADD COLUMN "providerCheckoutId" TEXT;
ALTER TABLE "CustomerPayment" ADD COLUMN "providerChargeId" TEXT;

CREATE UNIQUE INDEX "CustomerPayment_provider_providerCheckoutId_key"
  ON "CustomerPayment"("provider", "providerCheckoutId");
CREATE UNIQUE INDEX "CustomerPayment_provider_providerChargeId_key"
  ON "CustomerPayment"("provider", "providerChargeId");
