-- ============================================================================
-- PASO 5: Habilitar RLS + policies en las 26 tablas que ahora tienen institutionId
-- Estas tablas antes NO tenían institutionId directo y se protegían vía JOINs.
-- Ahora tienen institutionId directo y pueden tener policy propia.
-- ============================================================================
-- NOTA: Usa IF NOT EXISTS para ser idempotente (safe to re-run).
-- ============================================================================

-- 1. StudentEnrollment
ALTER TABLE "StudentEnrollment" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentEnrollment' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentEnrollment" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 2. TeacherAssignment
ALTER TABLE "TeacherAssignment" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='TeacherAssignment' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "TeacherAssignment" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 3. EnrollmentArea
ALTER TABLE "EnrollmentArea" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentArea' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentArea" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 4. EnrollmentSubject
ALTER TABLE "EnrollmentSubject" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentSubject' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentSubject" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 5. EnrollmentDimension
ALTER TABLE "EnrollmentDimension" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentDimension' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentDimension" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 6. EnrollmentEvent
ALTER TABLE "EnrollmentEvent" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EnrollmentEvent' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EnrollmentEvent" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 7. StudentGrade
ALTER TABLE "StudentGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 8. PeriodFinalGrade
ALTER TABLE "PeriodFinalGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PeriodFinalGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PeriodFinalGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 9. PartialGrade
ALTER TABLE "PartialGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PartialGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PartialGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 10. FinalComponentGrade
ALTER TABLE "FinalComponentGrade" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='FinalComponentGrade' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "FinalComponentGrade" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 11. PreventiveAlert
ALTER TABLE "PreventiveAlert" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PreventiveAlert' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PreventiveAlert" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 12. AttendanceRecord
ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='AttendanceRecord' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "AttendanceRecord" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 13. StudentObservation
ALTER TABLE "StudentObservation" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentObservation' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentObservation" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 14. ObserverCommitment
ALTER TABLE "ObserverCommitment" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ObserverCommitment' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "ObserverCommitment" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 15. GuardianCitation
ALTER TABLE "GuardianCitation" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='GuardianCitation' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "GuardianCitation" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 16. ObserverReferral
ALTER TABLE "ObserverReferral" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ObserverReferral' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "ObserverReferral" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 17. PedagogicalMeasure
ALTER TABLE "PedagogicalMeasure" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PedagogicalMeasure' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PedagogicalMeasure" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 18. EvaluativeActivity
ALTER TABLE "EvaluativeActivity" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='EvaluativeActivity' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "EvaluativeActivity" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 19. SubjectPerformance
ALTER TABLE "SubjectPerformance" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='SubjectPerformance' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "SubjectPerformance" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 20. PerformanceManualEdit
ALTER TABLE "PerformanceManualEdit" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PerformanceManualEdit' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PerformanceManualEdit" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 21. Achievement
ALTER TABLE "Achievement" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='Achievement' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "Achievement" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 22. AttitudinalAchievement
ALTER TABLE "AttitudinalAchievement" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='AttitudinalAchievement' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "AttitudinalAchievement" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 23. StudentAchievement
ALTER TABLE "StudentAchievement" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='StudentAchievement' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "StudentAchievement" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 24. PeriodRecovery
ALTER TABLE "PeriodRecovery" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='PeriodRecovery' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "PeriodRecovery" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 25. FinalRecoveryPlan
ALTER TABLE "FinalRecoveryPlan" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='FinalRecoveryPlan' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "FinalRecoveryPlan" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

-- 26. RoomRestriction
ALTER TABLE "RoomRestriction" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='RoomRestriction' AND policyname='tenant_isolation') THEN
    CREATE POLICY "tenant_isolation" ON "RoomRestriction" FOR ALL
      USING ("institutionId" = current_institution_id())
      WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;
