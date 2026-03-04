-- ============================================================================
-- MIGRATION: decimal_and_cascade_hardening
-- Date: 2026-03-04
-- Purpose: 
--   1) Widen all academic Decimal(3,1) columns to Decimal(5,2) to support 0-100 scales
--   2) Change 5 critical Cascade → Restrict to prevent accidental data destruction
-- Safety: 100% additive/safe. ALTER COLUMN widens precision (no data loss).
--         FK constraint changes are non-destructive.
-- ============================================================================

-- ============================================================================
-- PART 1: Decimal(3,1) → Decimal(5,2) — 19 columns in 10 models
-- ============================================================================

-- StudentGrade
ALTER TABLE "StudentGrade" ALTER COLUMN "score" SET DATA TYPE DECIMAL(5,2);

-- PeriodFinalGrade
ALTER TABLE "PeriodFinalGrade" ALTER COLUMN "finalScore" SET DATA TYPE DECIMAL(5,2);

-- PartialGrade
ALTER TABLE "PartialGrade" ALTER COLUMN "score" SET DATA TYPE DECIMAL(5,2);

-- FinalComponentGrade
ALTER TABLE "FinalComponentGrade" ALTER COLUMN "grade" SET DATA TYPE DECIMAL(5,2);

-- PreventiveCutConfig
ALTER TABLE "PreventiveCutConfig" ALTER COLUMN "riskThresholdScore" SET DATA TYPE DECIMAL(5,2);

-- PreventiveAlert
ALTER TABLE "PreventiveAlert" ALTER COLUMN "computedGrade" SET DATA TYPE DECIMAL(5,2);

-- RecoveryConfig (3 columns)
ALTER TABLE "RecoveryConfig" ALTER COLUMN "minPassingScore" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "RecoveryConfig" ALTER COLUMN "periodMaxScore" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "RecoveryConfig" ALTER COLUMN "finalMaxScore" SET DATA TYPE DECIMAL(5,2);

-- PeriodRecovery (3 columns)
ALTER TABLE "PeriodRecovery" ALTER COLUMN "originalScore" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "PeriodRecovery" ALTER COLUMN "recoveryScore" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "PeriodRecovery" ALTER COLUMN "finalScore" SET DATA TYPE DECIMAL(5,2);

-- FinalRecoveryPlan (3 columns)
ALTER TABLE "FinalRecoveryPlan" ALTER COLUMN "originalAreaScore" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "FinalRecoveryPlan" ALTER COLUMN "recoveryScore" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "FinalRecoveryPlan" ALTER COLUMN "finalAreaScore" SET DATA TYPE DECIMAL(5,2);

-- ClassroomActivity
ALTER TABLE "ClassroomActivity" ALTER COLUMN "maxScore" SET DATA TYPE DECIMAL(5,2);

-- ActivityQuestion
ALTER TABLE "ActivityQuestion" ALTER COLUMN "points" SET DATA TYPE DECIMAL(5,2);

-- ActivitySubmission
ALTER TABLE "ActivitySubmission" ALTER COLUMN "score" SET DATA TYPE DECIMAL(5,2);

-- QuestionAnswer
ALTER TABLE "QuestionAnswer" ALTER COLUMN "pointsEarned" SET DATA TYPE DECIMAL(5,2);

-- ============================================================================
-- PART 2: Cascade → Restrict — 5 critical foreign keys
-- ============================================================================

-- 7.3 — Classroom → TeacherAssignment: prevent destroying entire virtual classroom
ALTER TABLE "Classroom" DROP CONSTRAINT "Classroom_teacherAssignmentId_fkey";
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherAssignmentId_fkey" 
  FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7.4 — AcademicYear → Institution: prevent cascading deletion of all academic data
ALTER TABLE "AcademicYear" DROP CONSTRAINT "AcademicYear_institutionId_fkey";
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_institutionId_fkey" 
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7.2 — Area → Institution: prevent cascading deletion of subjects and grades
ALTER TABLE "Area" DROP CONSTRAINT "Area_institutionId_fkey";
ALTER TABLE "Area" ADD CONSTRAINT "Area_institutionId_fkey" 
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Campus → Institution: prevent cascading deletion of campus infrastructure
ALTER TABLE "Campus" DROP CONSTRAINT "Campus_institutionId_fkey";
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_institutionId_fkey" 
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4.7 — PeriodRecovery → Subject: protect recovery records from subject deletion
ALTER TABLE "PeriodRecovery" DROP CONSTRAINT "PeriodRecovery_subjectId_fkey";
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_subjectId_fkey" 
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
