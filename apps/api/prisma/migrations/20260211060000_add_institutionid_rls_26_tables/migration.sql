-- ============================================================================
-- Migration: Add institutionId to 26 tables + populate + RLS + FORCE RLS
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1: Add nullable institutionId columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "StudentEnrollment" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "TeacherAssignment" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "EnrollmentArea" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "EnrollmentSubject" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "EnrollmentDimension" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "EnrollmentEvent" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "StudentGrade" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PeriodFinalGrade" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PartialGrade" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PreventiveAlert" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "StudentObservation" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "ObserverCommitment" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "GuardianCitation" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "ObserverReferral" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PedagogicalMeasure" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "EvaluativeActivity" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "SubjectPerformance" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PerformanceManualEdit" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "Achievement" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "AttitudinalAchievement" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "StudentAchievement" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PeriodRecovery" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "FinalRecoveryPlan" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "RoomRestriction" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 2: Populate institutionId from parent tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Level 1: Direct joins (1 hop)
UPDATE "StudentEnrollment" se
SET "institutionId" = s."institutionId"
FROM "Student" s
WHERE se."studentId" = s."id" AND se."institutionId" IS NULL;

UPDATE "TeacherAssignment" ta
SET "institutionId" = ay."institutionId"
FROM "AcademicYear" ay
WHERE ta."academicYearId" = ay."id" AND ta."institutionId" IS NULL;

-- Level 2: Via StudentEnrollment -> Student (2 hops)
UPDATE "EnrollmentArea" ea
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE ea."enrollmentId" = se."id" AND ea."institutionId" IS NULL;

UPDATE "EnrollmentSubject" es
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE es."enrollmentId" = se."id" AND es."institutionId" IS NULL;

UPDATE "EnrollmentDimension" ed
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE ed."enrollmentId" = se."id" AND ed."institutionId" IS NULL;

UPDATE "EnrollmentEvent" ee
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE ee."enrollmentId" = se."id" AND ee."institutionId" IS NULL;

UPDATE "StudentGrade" sg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE sg."studentEnrollmentId" = se."id" AND sg."institutionId" IS NULL;

UPDATE "PeriodFinalGrade" pfg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE pfg."studentEnrollmentId" = se."id" AND pfg."institutionId" IS NULL;

UPDATE "PartialGrade" pg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE pg."studentEnrollmentId" = se."id" AND pg."institutionId" IS NULL;

UPDATE "PreventiveAlert" pa
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE pa."studentEnrollmentId" = se."id" AND pa."institutionId" IS NULL;

UPDATE "StudentObservation" so
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE so."studentEnrollmentId" = se."id" AND so."institutionId" IS NULL;

UPDATE "ObserverCommitment" oc
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE oc."studentEnrollmentId" = se."id" AND oc."institutionId" IS NULL;

UPDATE "GuardianCitation" gc
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE gc."studentEnrollmentId" = se."id" AND gc."institutionId" IS NULL;

UPDATE "ObserverReferral" orr
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE orr."studentEnrollmentId" = se."id" AND orr."institutionId" IS NULL;

UPDATE "PedagogicalMeasure" pm
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE pm."studentEnrollmentId" = se."id" AND pm."institutionId" IS NULL;

UPDATE "PeriodRecovery" pr
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE pr."studentEnrollmentId" = se."id" AND pr."institutionId" IS NULL;

UPDATE "FinalRecoveryPlan" frp
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE frp."studentEnrollmentId" = se."id" AND frp."institutionId" IS NULL;

UPDATE "PerformanceManualEdit" pme
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE pme."studentEnrollmentId" = se."id" AND pme."institutionId" IS NULL;

UPDATE "StudentAchievement" sa
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se JOIN "Student" s ON se."studentId" = s."id"
WHERE sa."studentEnrollmentId" = se."id" AND sa."institutionId" IS NULL;

-- Level 2: Via TeacherAssignment -> AcademicYear (2 hops)
UPDATE "AttendanceRecord" ar
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE ar."teacherAssignmentId" = ta."id" AND ar."institutionId" IS NULL;

UPDATE "EvaluativeActivity" eva
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE eva."teacherAssignmentId" = ta."id" AND eva."institutionId" IS NULL;

UPDATE "SubjectPerformance" sp
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE sp."teacherAssignmentId" = ta."id" AND sp."institutionId" IS NULL;

UPDATE "Achievement" ach
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE ach."teacherAssignmentId" = ta."id" AND ach."institutionId" IS NULL;

UPDATE "AttitudinalAchievement" aa
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE aa."teacherAssignmentId" = ta."id" AND aa."institutionId" IS NULL;

-- Level 2: Via Room (1 hop)
UPDATE "RoomRestriction" rr
SET "institutionId" = r."institutionId"
FROM "Room" r
WHERE rr."roomId" = r."id" AND rr."institutionId" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3: Set NOT NULL + Add FK constraints
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "StudentEnrollment" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "TeacherAssignment" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "EnrollmentArea" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "EnrollmentSubject" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "EnrollmentDimension" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "EnrollmentEvent" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "StudentGrade" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PeriodFinalGrade" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PartialGrade" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PreventiveAlert" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "StudentObservation" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "ObserverCommitment" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "GuardianCitation" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "ObserverReferral" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PedagogicalMeasure" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "EvaluativeActivity" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "SubjectPerformance" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PerformanceManualEdit" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Achievement" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "AttitudinalAchievement" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "StudentAchievement" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PeriodRecovery" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "FinalRecoveryPlan" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "RoomRestriction" ALTER COLUMN "institutionId" SET NOT NULL;

-- FK constraints
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentDimension" ADD CONSTRAINT "EnrollmentDimension_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectPerformance" ADD CONSTRAINT "SubjectPerformance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomRestriction" ADD CONSTRAINT "RoomRestriction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 4: RLS function + Enable RLS + Policies on the 26 new tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION current_institution_id() RETURNS text AS $$
  SELECT coalesce(nullif(current_setting('app.current_institution', true), ''), '__none__');
$$ LANGUAGE sql STABLE;

-- StudentEnrollment
ALTER TABLE "StudentEnrollment" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentEnrollment' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentEnrollment" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- TeacherAssignment
ALTER TABLE "TeacherAssignment" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='TeacherAssignment' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "TeacherAssignment" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- EnrollmentArea
ALTER TABLE "EnrollmentArea" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentArea' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentArea" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- EnrollmentSubject
ALTER TABLE "EnrollmentSubject" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentSubject' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentSubject" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- EnrollmentDimension
ALTER TABLE "EnrollmentDimension" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentDimension' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentDimension" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- EnrollmentEvent
ALTER TABLE "EnrollmentEvent" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentEvent' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentEvent" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- StudentGrade
ALTER TABLE "StudentGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- PeriodFinalGrade
ALTER TABLE "PeriodFinalGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PeriodFinalGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PeriodFinalGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- PartialGrade
ALTER TABLE "PartialGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PartialGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PartialGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- PreventiveAlert
ALTER TABLE "PreventiveAlert" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PreventiveAlert' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PreventiveAlert" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- AttendanceRecord
ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='AttendanceRecord' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "AttendanceRecord" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- StudentObservation
ALTER TABLE "StudentObservation" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentObservation' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentObservation" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- ObserverCommitment
ALTER TABLE "ObserverCommitment" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ObserverCommitment' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "ObserverCommitment" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- GuardianCitation
ALTER TABLE "GuardianCitation" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='GuardianCitation' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "GuardianCitation" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- ObserverReferral
ALTER TABLE "ObserverReferral" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ObserverReferral' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "ObserverReferral" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- PedagogicalMeasure
ALTER TABLE "PedagogicalMeasure" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PedagogicalMeasure' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PedagogicalMeasure" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- EvaluativeActivity
ALTER TABLE "EvaluativeActivity" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EvaluativeActivity' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EvaluativeActivity" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- SubjectPerformance
ALTER TABLE "SubjectPerformance" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='SubjectPerformance' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "SubjectPerformance" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- PerformanceManualEdit
ALTER TABLE "PerformanceManualEdit" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PerformanceManualEdit' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PerformanceManualEdit" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- Achievement
ALTER TABLE "Achievement" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='Achievement' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "Achievement" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- AttitudinalAchievement
ALTER TABLE "AttitudinalAchievement" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='AttitudinalAchievement' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "AttitudinalAchievement" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- StudentAchievement
ALTER TABLE "StudentAchievement" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentAchievement' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentAchievement" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- PeriodRecovery
ALTER TABLE "PeriodRecovery" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PeriodRecovery' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PeriodRecovery" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- FinalRecoveryPlan
ALTER TABLE "FinalRecoveryPlan" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='FinalRecoveryPlan' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "FinalRecoveryPlan" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- RoomRestriction
ALTER TABLE "RoomRestriction" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='RoomRestriction' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "RoomRestriction" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 5: FORCE ROW LEVEL SECURITY on the 26 new tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "StudentEnrollment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeacherAssignment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentArea" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentSubject" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentDimension" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentGrade" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PeriodFinalGrade" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PartialGrade" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PreventiveAlert" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceRecord" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentObservation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ObserverCommitment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "GuardianCitation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ObserverReferral" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PedagogicalMeasure" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EvaluativeActivity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SubjectPerformance" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceManualEdit" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Achievement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AttitudinalAchievement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "StudentAchievement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PeriodRecovery" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FinalRecoveryPlan" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RoomRestriction" FORCE ROW LEVEL SECURITY;
