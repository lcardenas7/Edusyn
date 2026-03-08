-- APD/PIAR Upgrade Migration
-- All changes are ADDITIVE (new columns with defaults, new tables, new enums)
-- Safe for production: no data loss, no column drops, no renames

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. NEW ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "SupportPlanType" AS ENUM ('APD', 'PIAR');
CREATE TYPE "AdjustmentType" AS ENUM ('CURRICULAR', 'METHODOLOGICAL', 'EVALUATIVE', 'COMMUNICATION', 'ENVIRONMENTAL');
CREATE TYPE "PlanParticipantRole" AS ENUM ('TEACHER', 'COUNSELOR', 'COORDINATOR', 'FAMILY_MEMBER', 'EXTERNAL_SPECIALIST');
CREATE TYPE "SupportDocumentType" AS ENUM ('EVIDENCE', 'FAMILY_DOCUMENT', 'ASSESSMENT', 'REPORT');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ALTER PedagogicalSupportPlan — add new columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "planType" "SupportPlanType" NOT NULL DEFAULT 'APD';
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "planApprovedByFamily" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "familyApprovalDate" TIMESTAMP(3);
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "familySignatureUrl" TEXT;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "previousPlanId" TEXT;

-- Self-referencing FK for version history
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_previousPlanId_fkey" FOREIGN KEY ("previousPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PedagogicalSupportPlan_planType_idx" ON "PedagogicalSupportPlan"("planType");
CREATE INDEX "PedagogicalSupportPlan_previousPlanId_idx" ON "PedagogicalSupportPlan"("previousPlanId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ALTER EducationalSupportProfile — add diagnostic fields + categoryId
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "EducationalSupportProfile" ADD COLUMN "supportCategoryId" TEXT;
ALTER TABLE "EducationalSupportProfile" ADD COLUMN "learningBarriers" TEXT;
ALTER TABLE "EducationalSupportProfile" ADD COLUMN "strengths" TEXT;
ALTER TABLE "EducationalSupportProfile" ADD COLUMN "supportNeeds" TEXT;
ALTER TABLE "EducationalSupportProfile" ADD COLUMN "learningStyleObservations" TEXT;

CREATE INDEX "EducationalSupportProfile_supportCategoryId_idx" ON "EducationalSupportProfile"("supportCategoryId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ALTER SupportActivity — add adjustmentType
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "SupportActivity" ADD COLUMN "adjustmentType" "AdjustmentType";

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ALTER StudentObservation — add supportProfileId (Observer ↔ APD)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "StudentObservation" ADD COLUMN "supportProfileId" TEXT;

ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_supportProfileId_fkey" FOREIGN KEY ("supportProfileId") REFERENCES "EducationalSupportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StudentObservation_supportProfileId_idx" ON "StudentObservation"("supportProfileId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. CREATE SupportCategory
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "SupportCategory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportCategory_institutionId_name_key" ON "SupportCategory"("institutionId", "name");
CREATE INDEX "SupportCategory_institutionId_idx" ON "SupportCategory"("institutionId");
CREATE INDEX "SupportCategory_active_idx" ON "SupportCategory"("active");

ALTER TABLE "SupportCategory" ADD CONSTRAINT "SupportCategory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK from EducationalSupportProfile to SupportCategory
ALTER TABLE "EducationalSupportProfile" ADD CONSTRAINT "EducationalSupportProfile_supportCategoryId_fkey" FOREIGN KEY ("supportCategoryId") REFERENCES "SupportCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CREATE SupportPlanParticipant
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "SupportPlanParticipant" (
    "id" TEXT NOT NULL,
    "supportPlanId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "PlanParticipantRole" NOT NULL,
    "fullName" TEXT,
    "relationship" TEXT,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "signatureUrl" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportPlanParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportPlanParticipant_supportPlanId_userId_role_key" ON "SupportPlanParticipant"("supportPlanId", "userId", "role");
CREATE INDEX "SupportPlanParticipant_supportPlanId_idx" ON "SupportPlanParticipant"("supportPlanId");
CREATE INDEX "SupportPlanParticipant_userId_idx" ON "SupportPlanParticipant"("userId");

ALTER TABLE "SupportPlanParticipant" ADD CONSTRAINT "SupportPlanParticipant_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportPlanParticipant" ADD CONSTRAINT "SupportPlanParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. CREATE SupportPlanSubject
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "SupportPlanSubject" (
    "id" TEXT NOT NULL,
    "supportPlanId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "specificNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportPlanSubject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportPlanSubject_supportPlanId_subjectId_key" ON "SupportPlanSubject"("supportPlanId", "subjectId");
CREATE INDEX "SupportPlanSubject_supportPlanId_idx" ON "SupportPlanSubject"("supportPlanId");
CREATE INDEX "SupportPlanSubject_subjectId_idx" ON "SupportPlanSubject"("subjectId");
CREATE INDEX "SupportPlanSubject_teacherId_idx" ON "SupportPlanSubject"("teacherId");

ALTER TABLE "SupportPlanSubject" ADD CONSTRAINT "SupportPlanSubject_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportPlanSubject" ADD CONSTRAINT "SupportPlanSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportPlanSubject" ADD CONSTRAINT "SupportPlanSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. CREATE SupportDocument
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "SupportDocument" (
    "id" TEXT NOT NULL,
    "supportPlanId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "type" "SupportDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportDocument_supportPlanId_idx" ON "SupportDocument"("supportPlanId");
CREATE INDEX "SupportDocument_type_idx" ON "SupportDocument"("type");

ALTER TABLE "SupportDocument" ADD CONSTRAINT "SupportDocument_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportDocument" ADD CONSTRAINT "SupportDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
