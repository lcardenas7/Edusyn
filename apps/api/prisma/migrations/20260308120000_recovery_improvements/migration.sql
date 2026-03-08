-- ============================================
-- MEJORAS AL MÓDULO DE RECUPERACIONES ACADÉMICAS
-- Cambios 100% aditivos (seguro para producción)
-- ============================================

-- 1. Nuevo enum: RecoveryActivityType (tipo de actividad pedagógica)
CREATE TYPE "RecoveryActivityType" AS ENUM ('REINFORCEMENT', 'LEVELING', 'EXAM', 'VALIDATION', 'WORKSHOP', 'PROJECT');

-- 2. Nuevo enum: PromotionStatus (estado de promoción del estudiante)
CREATE TYPE "PromotionStatus" AS ENUM ('IN_PROGRESS', 'PROMOTED', 'PROMOTED_AFTER_RECOVERY', 'RETAINED', 'PENDING_RECOVERY', 'TRANSFERRED', 'WITHDRAWN');

-- 3. Agregar nuevos valores al enum RecoveryStatus
ALTER TYPE "RecoveryStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "RecoveryStatus" ADD VALUE IF NOT EXISTS 'REVIEW_PENDING';

-- 4. Agregar promotionStatus a StudentEnrollment
ALTER TABLE "StudentEnrollment" ADD COLUMN IF NOT EXISTS "promotionStatus" "PromotionStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- 5. Nuevos campos en RecoveryConfig
ALTER TABLE "RecoveryConfig" ADD COLUMN IF NOT EXISTS "periodRecoveryMaxAttempts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RecoveryConfig" ADD COLUMN IF NOT EXISTS "finalRecoveryMaxAttempts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RecoveryConfig" ADD COLUMN IF NOT EXISTS "maxSubjectsRecoverable" INTEGER;
ALTER TABLE "RecoveryConfig" ADD COLUMN IF NOT EXISTS "autoRetainAreas" INTEGER;
ALTER TABLE "RecoveryConfig" ADD COLUMN IF NOT EXISTS "autoRetainSubjects" INTEGER;

-- 6. Nuevos campos en PeriodRecovery
ALTER TABLE "PeriodRecovery" ADD COLUMN IF NOT EXISTS "activityType" "RecoveryActivityType";
ALTER TABLE "PeriodRecovery" ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PeriodRecovery" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

-- 7. Nuevos campos en FinalRecoveryPlan
ALTER TABLE "FinalRecoveryPlan" ADD COLUMN IF NOT EXISTS "activityType" "RecoveryActivityType";
ALTER TABLE "FinalRecoveryPlan" ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- 8. Nuevos campos en AcademicAct
ALTER TABLE "AcademicAct" ADD COLUMN IF NOT EXISTS "participants" JSONB;
ALTER TABLE "AcademicAct" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "AcademicAct" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- 9. Crear tabla RecoveryRule
CREATE TABLE IF NOT EXISTS "RecoveryRule" (
    "id" TEXT NOT NULL,
    "recoveryConfigId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "appliesTo" "RecoveryType" NOT NULL,
    "activityType" "RecoveryActivityType" NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,
    "impactType" "RecoveryImpactType" NOT NULL DEFAULT 'ADJUST_TO_MINIMUM',
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryRule_pkey" PRIMARY KEY ("id")
);

-- 10. Índices para RecoveryRule
CREATE INDEX IF NOT EXISTS "RecoveryRule_institutionId_idx" ON "RecoveryRule"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryRule_recoveryConfigId_appliesTo_activityType_key" ON "RecoveryRule"("recoveryConfigId", "appliesTo", "activityType");

-- 11. Foreign keys para RecoveryRule
ALTER TABLE "RecoveryRule" ADD CONSTRAINT "RecoveryRule_recoveryConfigId_fkey" FOREIGN KEY ("recoveryConfigId") REFERENCES "RecoveryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryRule" ADD CONSTRAINT "RecoveryRule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 12. Foreign key para PeriodRecovery.reviewedById
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
