-- BharatSatya PostgreSQL Initial Migration
-- SIH26261 · AI-Powered Application Validation, Document Authentication & Regulatory Compliance

-- Create Enums
CREATE TYPE "UserRole" AS ENUM ('APPLICANT', 'REVIEWER', 'ADMIN');
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_AUTOMATED_REVIEW', 'DEFICIENCY_FLAGGED', 'CLARIFICATION_REQUESTED', 'VERIFIED_RECOMMENDED', 'REJECTED_NON_COMPLIANT', 'APPROVED');
CREATE TYPE "DocumentType" AS ENUM ('LAND_TITLE_DEED', 'BUILDING_PLAN_APPROVAL', 'FIRE_SAFETY_NOC', 'OCCUPANCY_CERTIFICATE', 'SOCIETY_TRUST_REGISTRATION', 'FDR_FINANCIAL_ENDOWMENT', 'AICTE_PREVIOUS_EOA');
CREATE TYPE "FindingStatus" AS ENUM ('PASSED', 'MISSING', 'EXPIRED', 'MISMATCH', 'PENDING_VERIFICATION', 'MANUAL_REVIEW_REQUIRED');
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'INFO');
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'MISMATCH_DETECTED', 'EXPIRED', 'PENDING', 'SOURCE_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED');
CREATE TYPE "ReviewActionType" AS ENUM ('STATUS_CHANGE', 'CLARIFICATION_REQUEST', 'NOTE_ADDED', 'FINDING_OVERRIDE', 'FIELD_CORRECTED');

-- CreateTable Institution
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aictePermanentId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "establishedYear" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'APPLICANT',
    "department" TEXT,
    "designation" TEXT,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable Application
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-2027',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3),
    "assignedReviewerId" TEXT,
    "currentStage" TEXT NOT NULL DEFAULT 'Initial Intake Verification',
    "recommendedAction" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable Document
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileHashSha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfDocumentId" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "ocrRawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExtractedField
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "originalExtractedValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "isCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctedByUserId" TEXT,
    "correctedAt" TIMESTAMP(3),
    "evidencePage" INTEGER DEFAULT 1,
    "evidenceSnippet" TEXT,
    "evidenceCoordinates" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable ValidationRule
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ALL',
    "officialSourceReference" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "ruleType" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'CRITICAL',
    "logicConfigJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable ValidationRuleVersion
CREATE TABLE "ValidationRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logicConfigJson" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable ValidationFinding
CREATE TABLE "ValidationFinding" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "documentId" TEXT,
    "status" "FindingStatus" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidenceLocation" TEXT,
    "evidenceSnippet" TEXT,
    "evidenceComparisonJson" TEXT,
    "reviewerAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ValidationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable VerificationRequest
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT,
    "provider" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "responseSummary" TEXT NOT NULL,
    "evidenceReference" TEXT NOT NULL,
    "rawResponseJson" TEXT,
    "isDemoSimulation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReviewAction
CREATE TABLE "ReviewAction" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "actionType" "ReviewActionType" NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable AuditEvent
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeStateJson" TEXT,
    "afterStateJson" TEXT,
    "ipAddress" TEXT DEFAULT '127.0.0.1',
    "userAgent" TEXT DEFAULT 'BharatSatya-Agent/1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Unique Indexes
CREATE UNIQUE INDEX "Institution_aictePermanentId_key" ON "Institution"("aictePermanentId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ValidationRule_code_key" ON "ValidationRule"("code");

-- Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ValidationRuleVersion" ADD CONSTRAINT "ValidationRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
