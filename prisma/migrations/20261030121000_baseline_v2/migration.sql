-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "RequestState" AS ENUM ('DRAFT', 'SUBMITTED', 'ANALYZING', 'NEEDS_CLARIFICATION', 'SCOPED', 'QUOTED', 'APPROVED', 'AWAITING_FUNDS', 'FUNDED', 'PROJECT_CREATED', 'UNSUPPORTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProjectState" AS ENUM ('PLANNING', 'PROCUREMENT', 'RUNNING', 'QA', 'CUSTOMER_REVIEW', 'DELIVERED', 'CLOSED', 'BLOCKED', 'REVISION', 'DISPUTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupplierJobState" AS ENUM ('PROPOSED', 'APPROVED_TO_HIRE', 'CREATE_PENDING', 'HIRED', 'ACTIVE', 'SUBMITTED', 'QA_PASSED', 'ACCEPTED', 'QA_FAILED', 'REVISION_REQUESTED', 'CANCELLED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('CREATED', 'PENDING', 'VERIFIED', 'ALLOCATED', 'RECONCILED', 'FAILED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "QuoteState" AS ENUM ('DRAFT', 'PRESENTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReceiptAnchorState" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'RETRY_PENDING', 'RECONCILIATION_REQUIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReceiptKind" AS ENUM ('PROJECT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "FileScanState" AS ENUM ('PENDING', 'CLEAN', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('PENDING', 'PUBLISHED', 'RETRY_PENDING', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "LedgerSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "state" "RequestState" NOT NULL DEFAULT 'DRAFT',
    "rawBrief" TEXT NOT NULL,
    "desiredOutcome" TEXT,
    "budgetMinor" BIGINT,
    "budgetCurrency" TEXT,
    "deadline" TIMESTAMP(3),
    "constraintsJson" JSONB,
    "analysisJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAnswer" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "requestId" UUID,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "scanState" "FileScanState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "state" "ProjectState" NOT NULL DEFAULT 'PLANNING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "taskKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "inputContractJson" JSONB NOT NULL,
    "outputContractJson" JSONB NOT NULL,
    "dependenciesJson" JSONB NOT NULL,
    "capabilitiesJson" JSONB NOT NULL,
    "validationRulesJson" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "budgetMinor" BIGINT NOT NULL,
    "budgetCurrency" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "retryLimit" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "QuoteState" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "customerTotalMinor" BIGINT NOT NULL,
    "supplierCapMinor" BIGINT NOT NULL,
    "executionCostMinor" BIGINT NOT NULL,
    "reserveMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL,
    "estimatedMarginMinor" BIGINT NOT NULL,
    "scopeJson" JSONB NOT NULL,
    "assumptionsJson" JSONB NOT NULL,
    "exclusionsJson" JSONB NOT NULL,
    "termsJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "presentedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierServiceObservation" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalServiceId" TEXT NOT NULL,
    "externalAgentId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "capabilitiesJson" JSONB NOT NULL,
    "pricingJson" JSONB NOT NULL,
    "availabilityJson" JSONB NOT NULL,
    "rawReference" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SupplierServiceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierMatch" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "serviceObservationId" UUID NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "score" DECIMAL(8,4),
    "reasonsJson" JSONB NOT NULL,
    "selectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierJob" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalServiceId" TEXT NOT NULL,
    "externalJobId" TEXT,
    "state" "SupplierJobState" NOT NULL DEFAULT 'PROPOSED',
    "currency" TEXT NOT NULL,
    "authorizedMinor" BIGINT NOT NULL,
    "committedMinor" BIGINT NOT NULL DEFAULT 0,
    "settledMinor" BIGINT NOT NULL DEFAULT 0,
    "requestHash" TEXT,
    "rawStatus" TEXT,
    "lastObservedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "supplierJobId" UUID,
    "kind" TEXT NOT NULL,
    "objectKey" TEXT,
    "externalUrl" TEXT,
    "sha256" TEXT,
    "metadataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaReview" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "artifactId" UUID,
    "policyVersion" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "violationsJson" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "projectId" UUID,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "state" "PaymentState" NOT NULL DEFAULT 'CREATED',
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "allocatedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" UUID NOT NULL,
    "transactionType" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "externalReference" TEXT,
    "projectId" UUID,
    "paymentId" UUID,
    "supplierJobId" UUID,
    "metadataJson" JSONB NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "side" "LedgerSide" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" UUID NOT NULL,
    "policyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" UUID NOT NULL,
    "approvalType" TEXT NOT NULL,
    "state" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID,
    "decidedById" UUID,
    "projectId" UUID,
    "supplierJobId" UUID,
    "policyVersionId" UUID,
    "amountMinor" BIGINT,
    "currency" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "requestId" UUID,
    "projectId" UUID,
    "supplierJobId" UUID,
    "paymentId" UUID,
    "inputHash" TEXT,
    "reason" TEXT,
    "externalRefsJson" JSONB,
    "metadataJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" "OutboxState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB,
    "statusCode" INTEGER,
    "lockedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAnchor" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "kind" "ReceiptKind" NOT NULL,
    "state" "ReceiptAnchorState" NOT NULL DEFAULT 'PENDING',
    "schemaVersion" INTEGER NOT NULL,
    "referenceHash" TEXT NOT NULL,
    "canonicalRecordHash" TEXT NOT NULL,
    "providerReceiptHash" TEXT,
    "network" TEXT NOT NULL,
    "contractAccount" TEXT,
    "signerAccount" TEXT,
    "transactionHash" TEXT,
    "blockReference" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ServiceRequest_customerId_createdAt_idx" ON "ServiceRequest"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceRequest_state_updatedAt_idx" ON "ServiceRequest"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestAnswer_requestId_round_questionId_key" ON "RequestAnswer"("requestId", "round", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_objectKey_key" ON "StoredFile"("objectKey");

-- CreateIndex
CREATE INDEX "StoredFile_ownerId_createdAt_idx" ON "StoredFile"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StoredFile_requestId_idx" ON "StoredFile"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_requestId_key" ON "Project"("requestId");

-- CreateIndex
CREATE INDEX "Project_customerId_createdAt_idx" ON "Project"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Project_state_updatedAt_idx" ON "Project"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_idx" ON "ProjectTask"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTask_projectId_taskKey_key" ON "ProjectTask"("projectId", "taskKey");

-- CreateIndex
CREATE INDEX "Quote_requestId_state_idx" ON "Quote"("requestId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_requestId_version_key" ON "Quote"("requestId", "version");

-- CreateIndex
CREATE INDEX "SupplierServiceObservation_provider_externalServiceId_obser_idx" ON "SupplierServiceObservation"("provider", "externalServiceId", "observedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierServiceObservation_provider_externalServiceId_obser_key" ON "SupplierServiceObservation"("provider", "externalServiceId", "observedAt");

-- CreateIndex
CREATE INDEX "SupplierMatch_taskId_eligible_idx" ON "SupplierMatch"("taskId", "eligible");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMatch_taskId_serviceObservationId_key" ON "SupplierMatch"("taskId", "serviceObservationId");

-- CreateIndex
CREATE INDEX "SupplierJob_projectId_state_idx" ON "SupplierJob"("projectId", "state");

-- CreateIndex
CREATE INDEX "SupplierJob_taskId_idx" ON "SupplierJob"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierJob_provider_externalJobId_key" ON "SupplierJob"("provider", "externalJobId");

-- CreateIndex
CREATE INDEX "Artifact_projectId_createdAt_idx" ON "Artifact"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "QaReview_projectId_createdAt_idx" ON "QaReview"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPayment_customerId_createdAt_idx" ON "CustomerPayment"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CustomerPayment_state_updatedAt_idx" ON "CustomerPayment"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_provider_providerReference_key" ON "CustomerPayment"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_code_asset_key" ON "LedgerAccount"("code", "asset");

-- CreateIndex
CREATE INDEX "LedgerTransaction_projectId_postedAt_idx" ON "LedgerTransaction"("projectId", "postedAt");

-- CreateIndex
CREATE INDEX "LedgerTransaction_paymentId_idx" ON "LedgerTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_supplierJobId_idx" ON "LedgerTransaction"("supplierJobId");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyVersion_policyKey_active_idx" ON "PolicyVersion"("policyKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyKey_version_key" ON "PolicyVersion"("policyKey", "version");

-- CreateIndex
CREATE INDEX "Approval_state_expiresAt_idx" ON "Approval"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "Approval_projectId_idx" ON "Approval"("projectId");

-- CreateIndex
CREATE INDEX "Approval_supplierJobId_idx" ON "Approval"("supplierJobId");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_occurredAt_idx" ON "AuditEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_occurredAt_idx" ON "AuditEvent"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_occurredAt_idx" ON "AuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_state_availableAt_idx" ON "OutboxEvent"("state", "availableAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "IdempotencyRecord_lockedUntil_idx" ON "IdempotencyRecord"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_idempotencyKey_key" ON "IdempotencyRecord"("scope", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReceiptAnchor_projectId_kind_idx" ON "ReceiptAnchor"("projectId", "kind");

-- CreateIndex
CREATE INDEX "ReceiptAnchor_state_updatedAt_idx" ON "ReceiptAnchor"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAnchor_kind_referenceHash_key" ON "ReceiptAnchor"("kind", "referenceHash");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAnswer" ADD CONSTRAINT "RequestAnswer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMatch" ADD CONSTRAINT "SupplierMatch_serviceObservationId_fkey" FOREIGN KEY ("serviceObservationId") REFERENCES "SupplierServiceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierJob" ADD CONSTRAINT "SupplierJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierJob" ADD CONSTRAINT "SupplierJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_supplierJobId_fkey" FOREIGN KEY ("supplierJobId") REFERENCES "SupplierJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaReview" ADD CONSTRAINT "QaReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaReview" ADD CONSTRAINT "QaReview_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAnchor" ADD CONSTRAINT "ReceiptAnchor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
