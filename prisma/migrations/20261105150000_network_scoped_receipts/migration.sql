DROP INDEX "ReceiptAnchor_kind_referenceHash_key";
CREATE UNIQUE INDEX "ReceiptAnchor_network_kind_referenceHash_key"
  ON "ReceiptAnchor"("network", "kind", "referenceHash");
