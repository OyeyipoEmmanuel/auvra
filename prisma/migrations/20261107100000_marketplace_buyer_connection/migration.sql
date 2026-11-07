CREATE TABLE "MarketplaceBuyerConnection" (
  "id" TEXT NOT NULL,
  "accountId" UUID,
  "encryptedState" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "connectedAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceBuyerConnection_pkey" PRIMARY KEY ("id")
);
