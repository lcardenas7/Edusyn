-- ============================================================================
-- MIGRACIÓN: Evaluación Actitudinal (Autoevaluación, Coevaluación)
-- ============================================================================
-- Agrega soporte para rúbricas institucionales y evaluación actitudinal
-- integrada con el Aula Virtual
-- ============================================================================

-- 1. Crear enum para tipos de rúbrica actitudinal
CREATE TYPE "AttitudinalRubricType" AS ENUM ('SELF_ASSESSMENT', 'PEER_ASSESSMENT', 'TEACHER_ASSESSMENT');

-- 2. Agregar nuevos tipos de actividad al enum existente
ALTER TYPE "ClassroomActivityType" ADD VALUE IF NOT EXISTS 'SELF_ASSESSMENT';
ALTER TYPE "ClassroomActivityType" ADD VALUE IF NOT EXISTS 'PEER_ASSESSMENT';

-- 3. Crear tabla de rúbricas institucionales
CREATE TABLE "AttitudinalRubric" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AttitudinalRubricType" NOT NULL,
    "targetProcess" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttitudinalRubric_pkey" PRIMARY KEY ("id")
);

-- 4. Crear tabla de criterios de evaluación
CREATE TABLE "AttitudinalCriterion" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttitudinalCriterion_pkey" PRIMARY KEY ("id")
);

-- 5. Crear tabla de niveles de desempeño
CREATE TABLE "CriterionLevel" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" DECIMAL(3,1) NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CriterionLevel_pkey" PRIMARY KEY ("id")
);

-- 6. Crear tabla de envíos de evaluación actitudinal
CREATE TABLE "AttitudinalSubmission" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "evaluatorEnrollmentId" TEXT NOT NULL,
    "targetEnrollmentId" TEXT,
    "reflection" TEXT,
    "calculatedScore" DECIMAL(3,2),
    "syncedToGradebook" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttitudinalSubmission_pkey" PRIMARY KEY ("id")
);

-- 7. Crear tabla de respuestas a criterios
CREATE TABLE "AttitudinalCriterionResponse" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "AttitudinalCriterionResponse_pkey" PRIMARY KEY ("id")
);

-- 8. Crear tabla de pares para coevaluación
CREATE TABLE "PeerAssessmentPair" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "evaluatorEnrollmentId" TEXT NOT NULL,
    "targetEnrollmentId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerAssessmentPair_pkey" PRIMARY KEY ("id")
);

-- 9. Agregar columna rubricId a ClassroomActivity
ALTER TABLE "ClassroomActivity" ADD COLUMN "rubricId" TEXT;

-- 10. Crear índices
CREATE INDEX "AttitudinalRubric_institutionId_type_idx" ON "AttitudinalRubric"("institutionId", "type");
CREATE INDEX "AttitudinalRubric_institutionId_isDefault_idx" ON "AttitudinalRubric"("institutionId", "isDefault");
CREATE INDEX "AttitudinalCriterion_rubricId_idx" ON "AttitudinalCriterion"("rubricId");
CREATE INDEX "CriterionLevel_criterionId_idx" ON "CriterionLevel"("criterionId");
CREATE INDEX "AttitudinalSubmission_activityId_idx" ON "AttitudinalSubmission"("activityId");
CREATE INDEX "AttitudinalSubmission_evaluatorEnrollmentId_idx" ON "AttitudinalSubmission"("evaluatorEnrollmentId");
CREATE INDEX "AttitudinalSubmission_targetEnrollmentId_idx" ON "AttitudinalSubmission"("targetEnrollmentId");
CREATE INDEX "AttitudinalCriterionResponse_submissionId_idx" ON "AttitudinalCriterionResponse"("submissionId");
CREATE INDEX "PeerAssessmentPair_activityId_idx" ON "PeerAssessmentPair"("activityId");
CREATE INDEX "PeerAssessmentPair_evaluatorEnrollmentId_idx" ON "PeerAssessmentPair"("evaluatorEnrollmentId");

-- 11. Crear constraints únicos
CREATE UNIQUE INDEX "AttitudinalRubric_institutionId_name_key" ON "AttitudinalRubric"("institutionId", "name");
CREATE UNIQUE INDEX "AttitudinalSubmission_activityId_evaluatorEnrollmentId_targetEnrollmentId_key" ON "AttitudinalSubmission"("activityId", "evaluatorEnrollmentId", "targetEnrollmentId");
CREATE UNIQUE INDEX "AttitudinalCriterionResponse_submissionId_criterionId_key" ON "AttitudinalCriterionResponse"("submissionId", "criterionId");
CREATE UNIQUE INDEX "PeerAssessmentPair_activityId_evaluatorEnrollmentId_targetEnrollmentId_key" ON "PeerAssessmentPair"("activityId", "evaluatorEnrollmentId", "targetEnrollmentId");

-- 12. Crear foreign keys
ALTER TABLE "AttitudinalRubric" ADD CONSTRAINT "AttitudinalRubric_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttitudinalRubric" ADD CONSTRAINT "AttitudinalRubric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttitudinalCriterion" ADD CONSTRAINT "AttitudinalCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "AttitudinalRubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CriterionLevel" ADD CONSTRAINT "CriterionLevel_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "AttitudinalCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttitudinalSubmission" ADD CONSTRAINT "AttitudinalSubmission_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttitudinalSubmission" ADD CONSTRAINT "AttitudinalSubmission_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "AttitudinalRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttitudinalSubmission" ADD CONSTRAINT "AttitudinalSubmission_evaluatorEnrollmentId_fkey" FOREIGN KEY ("evaluatorEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttitudinalSubmission" ADD CONSTRAINT "AttitudinalSubmission_targetEnrollmentId_fkey" FOREIGN KEY ("targetEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttitudinalCriterionResponse" ADD CONSTRAINT "AttitudinalCriterionResponse_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AttitudinalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttitudinalCriterionResponse" ADD CONSTRAINT "AttitudinalCriterionResponse_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "AttitudinalCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttitudinalCriterionResponse" ADD CONSTRAINT "AttitudinalCriterionResponse_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CriterionLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerAssessmentPair" ADD CONSTRAINT "PeerAssessmentPair_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeerAssessmentPair" ADD CONSTRAINT "PeerAssessmentPair_evaluatorEnrollmentId_fkey" FOREIGN KEY ("evaluatorEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeerAssessmentPair" ADD CONSTRAINT "PeerAssessmentPair_targetEnrollmentId_fkey" FOREIGN KEY ("targetEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassroomActivity" ADD CONSTRAINT "ClassroomActivity_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "AttitudinalRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
