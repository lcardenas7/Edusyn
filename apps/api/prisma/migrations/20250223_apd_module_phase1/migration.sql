-- APD Module Phase 1: Acompañamiento Pedagógico Diferencial
-- MIGRACIÓN 100% ADITIVA — NO destructiva, NO elimina datos
-- Fecha: 2025-02-23

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Nuevos enums
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "AdaptationLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ActivityCompletionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ApdAuditAction" AS ENUM (
  'PROFILE_CREATED', 'PROFILE_UPDATED', 'PROFILE_ACTIVATED', 'PROFILE_DEACTIVATED',
  'PROFILE_VIEWED', 'PLAN_CREATED', 'PLAN_UPDATED', 'PLAN_STATUS_CHANGED',
  'PLAN_PROGRESS_UPDATED', 'ACTIVITY_CREATED', 'ACTIVITY_UPDATED', 'PROGRESS_LOG_CREATED'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Configuración institucional APD (columnas nuevas en Institution)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Institution" ADD COLUMN "enableDifferentialSupport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Institution" ADD COLUMN "allowTeacherAccess" BOOLEAN NOT NULL DEFAULT true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Extender PedagogicalSupportPlan (columnas nuevas, todas nullable)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "supportProfileId" TEXT;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "objectives" JSONB;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "adaptationStrategies" JSONB;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "evaluationAdjustments" JSONB;
ALTER TABLE "PedagogicalSupportPlan" ADD COLUMN "progressPercentage" DECIMAL(5,2);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Crear tabla EducationalSupportProfile
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "EducationalSupportProfile" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "supportCategory" TEXT NOT NULL,
  "pedagogicalNotes" TEXT,
  "parentConsentAccepted" BOOLEAN NOT NULL DEFAULT false,
  "consentDate" TIMESTAMP(3),
  "consentDocumentUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EducationalSupportProfile_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Crear tabla SupportActivity
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "SupportActivity" (
  "id" TEXT NOT NULL,
  "supportPlanId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "originalActivityDescription" TEXT,
  "teacherFinalActivity" TEXT,
  "adaptationLevel" "AdaptationLevel" NOT NULL DEFAULT 'MEDIUM',
  "completionStatus" "ActivityCompletionStatus" NOT NULL DEFAULT 'PENDING',
  "teacherFeedback" TEXT,
  "studentPerformanceScore" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportActivity_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Crear tabla SupportProgressLog
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "SupportProgressLog" (
  "id" TEXT NOT NULL,
  "supportPlanId" TEXT NOT NULL,
  "progressIndicator" INTEGER NOT NULL,
  "qualitativeObservation" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportProgressLog_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Crear tabla ApdAuditLog
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "ApdAuditLog" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" "ApdAuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApdAuditLog_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Índices
-- ═══════════════════════════════════════════════════════════════════════════

-- EducationalSupportProfile
CREATE UNIQUE INDEX "EducationalSupportProfile_institutionId_studentId_key" ON "EducationalSupportProfile"("institutionId", "studentId");
CREATE INDEX "EducationalSupportProfile_institutionId_idx" ON "EducationalSupportProfile"("institutionId");
CREATE INDEX "EducationalSupportProfile_studentId_idx" ON "EducationalSupportProfile"("studentId");
CREATE INDEX "EducationalSupportProfile_active_idx" ON "EducationalSupportProfile"("active");

-- SupportActivity
CREATE INDEX "SupportActivity_supportPlanId_idx" ON "SupportActivity"("supportPlanId");
CREATE INDEX "SupportActivity_completionStatus_idx" ON "SupportActivity"("completionStatus");

-- SupportProgressLog
CREATE INDEX "SupportProgressLog_supportPlanId_idx" ON "SupportProgressLog"("supportPlanId");
CREATE INDEX "SupportProgressLog_createdById_idx" ON "SupportProgressLog"("createdById");

-- ApdAuditLog
CREATE INDEX "ApdAuditLog_institutionId_idx" ON "ApdAuditLog"("institutionId");
CREATE INDEX "ApdAuditLog_userId_idx" ON "ApdAuditLog"("userId");
CREATE INDEX "ApdAuditLog_entityType_entityId_idx" ON "ApdAuditLog"("entityType", "entityId");
CREATE INDEX "ApdAuditLog_createdAt_idx" ON "ApdAuditLog"("createdAt");

-- PedagogicalSupportPlan (nuevo índice para supportProfileId)
CREATE INDEX "PedagogicalSupportPlan_supportProfileId_idx" ON "PedagogicalSupportPlan"("supportProfileId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Foreign Keys
-- ═══════════════════════════════════════════════════════════════════════════

-- EducationalSupportProfile
ALTER TABLE "EducationalSupportProfile" ADD CONSTRAINT "EducationalSupportProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EducationalSupportProfile" ADD CONSTRAINT "EducationalSupportProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SupportActivity
ALTER TABLE "SupportActivity" ADD CONSTRAINT "SupportActivity_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SupportProgressLog
ALTER TABLE "SupportProgressLog" ADD CONSTRAINT "SupportProgressLog_supportPlanId_fkey" FOREIGN KEY ("supportPlanId") REFERENCES "PedagogicalSupportPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportProgressLog" ADD CONSTRAINT "SupportProgressLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ApdAuditLog
ALTER TABLE "ApdAuditLog" ADD CONSTRAINT "ApdAuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApdAuditLog" ADD CONSTRAINT "ApdAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PedagogicalSupportPlan → EducationalSupportProfile
ALTER TABLE "PedagogicalSupportPlan" ADD CONSTRAINT "PedagogicalSupportPlan_supportProfileId_fkey" FOREIGN KEY ("supportProfileId") REFERENCES "EducationalSupportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
