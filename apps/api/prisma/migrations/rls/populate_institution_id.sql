-- ============================================================================
-- PASO 3: Copiar institutionId desde tablas padre a las 26 tablas nuevas
-- Cada UPDATE usa JOINs para resolver el institutionId desde tablas que ya
-- lo tienen como campo requerido (Student, AcademicYear, Room).
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- NIVEL 1: Tablas con join directo (1 hop)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. StudentEnrollment → Student.institutionId
UPDATE "StudentEnrollment" se
SET "institutionId" = s."institutionId"
FROM "Student" s
WHERE se."studentId" = s."id"
  AND se."institutionId" IS NULL;

-- 2. TeacherAssignment → AcademicYear.institutionId
UPDATE "TeacherAssignment" ta
SET "institutionId" = ay."institutionId"
FROM "AcademicYear" ay
WHERE ta."academicYearId" = ay."id"
  AND ta."institutionId" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- NIVEL 2: Tablas vía StudentEnrollment → Student (2 hops)
-- ═══════════════════════════════════════════════════════════════════════════

-- 3. EnrollmentArea → SE → Student
UPDATE "EnrollmentArea" ea
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE ea."enrollmentId" = se."id"
  AND ea."institutionId" IS NULL;

-- 4. EnrollmentSubject → SE → Student
UPDATE "EnrollmentSubject" es
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE es."enrollmentId" = se."id"
  AND es."institutionId" IS NULL;

-- 5. EnrollmentDimension → SE → Student
UPDATE "EnrollmentDimension" ed
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE ed."enrollmentId" = se."id"
  AND ed."institutionId" IS NULL;

-- 6. EnrollmentEvent → SE → Student
UPDATE "EnrollmentEvent" ee
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE ee."enrollmentId" = se."id"
  AND ee."institutionId" IS NULL;

-- 7. StudentGrade → SE → Student
UPDATE "StudentGrade" sg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE sg."studentEnrollmentId" = se."id"
  AND sg."institutionId" IS NULL;

-- 8. PeriodFinalGrade → SE → Student
UPDATE "PeriodFinalGrade" pfg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE pfg."studentEnrollmentId" = se."id"
  AND pfg."institutionId" IS NULL;

-- 9. PartialGrade → SE → Student
UPDATE "PartialGrade" pg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE pg."studentEnrollmentId" = se."id"
  AND pg."institutionId" IS NULL;

-- 10. FinalComponentGrade → SE → Student
UPDATE "FinalComponentGrade" fcg
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE fcg."studentEnrollmentId" = se."id"
  AND fcg."institutionId" IS NULL;

-- 11. PreventiveAlert → SE → Student
UPDATE "PreventiveAlert" pa
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE pa."studentEnrollmentId" = se."id"
  AND pa."institutionId" IS NULL;

-- 12. AttendanceRecord → TA → AcademicYear
UPDATE "AttendanceRecord" ar
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta
JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE ar."teacherAssignmentId" = ta."id"
  AND ar."institutionId" IS NULL;

-- 13. StudentObservation → SE → Student
UPDATE "StudentObservation" so
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE so."studentEnrollmentId" = se."id"
  AND so."institutionId" IS NULL;

-- 14. ObserverCommitment → SE → Student
UPDATE "ObserverCommitment" oc
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE oc."studentEnrollmentId" = se."id"
  AND oc."institutionId" IS NULL;

-- 15. GuardianCitation → SE → Student
UPDATE "GuardianCitation" gc
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE gc."studentEnrollmentId" = se."id"
  AND gc."institutionId" IS NULL;

-- 16. ObserverReferral → SE → Student
UPDATE "ObserverReferral" orr
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE orr."studentEnrollmentId" = se."id"
  AND orr."institutionId" IS NULL;

-- 17. PedagogicalMeasure → SE → Student
UPDATE "PedagogicalMeasure" pm
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE pm."studentEnrollmentId" = se."id"
  AND pm."institutionId" IS NULL;

-- 18. PeriodRecovery → SE → Student
UPDATE "PeriodRecovery" pr
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE pr."studentEnrollmentId" = se."id"
  AND pr."institutionId" IS NULL;

-- 19. FinalRecoveryPlan → SE → Student
UPDATE "FinalRecoveryPlan" frp
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE frp."studentEnrollmentId" = se."id"
  AND frp."institutionId" IS NULL;

-- 20. PerformanceManualEdit → SE → Student
UPDATE "PerformanceManualEdit" pme
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE pme."studentEnrollmentId" = se."id"
  AND pme."institutionId" IS NULL;

-- 21. StudentAchievement → SE → Student
UPDATE "StudentAchievement" sa
SET "institutionId" = s."institutionId"
FROM "StudentEnrollment" se
JOIN "Student" s ON se."studentId" = s."id"
WHERE sa."studentEnrollmentId" = se."id"
  AND sa."institutionId" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- NIVEL 2: Tablas vía TeacherAssignment → AcademicYear (2 hops)
-- ═══════════════════════════════════════════════════════════════════════════

-- 22. EvaluativeActivity → TA → AcademicYear
UPDATE "EvaluativeActivity" eva
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta
JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE eva."teacherAssignmentId" = ta."id"
  AND eva."institutionId" IS NULL;

-- 23. SubjectPerformance → TA → AcademicYear
UPDATE "SubjectPerformance" sp
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta
JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE sp."teacherAssignmentId" = ta."id"
  AND sp."institutionId" IS NULL;

-- 24. Achievement → TA → AcademicYear
UPDATE "Achievement" ach
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta
JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE ach."teacherAssignmentId" = ta."id"
  AND ach."institutionId" IS NULL;

-- 25. AttitudinalAchievement → TA → AcademicYear
UPDATE "AttitudinalAchievement" aa
SET "institutionId" = ay."institutionId"
FROM "TeacherAssignment" ta
JOIN "AcademicYear" ay ON ta."academicYearId" = ay."id"
WHERE aa."teacherAssignmentId" = ta."id"
  AND aa."institutionId" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- NIVEL 2: Tablas vía Room (1 hop)
-- ═══════════════════════════════════════════════════════════════════════════

-- 26. RoomRestriction → Room.institutionId
UPDATE "RoomRestriction" rr
SET "institutionId" = r."institutionId"
FROM "Room" r
WHERE rr."roomId" = r."id"
  AND rr."institutionId" IS NULL;

-- ============================================================================
-- VERIFICACIÓN: Confirmar que no quedan NULLs
-- ============================================================================
DO $$
DECLARE
  null_count BIGINT;
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'StudentEnrollment', 'TeacherAssignment',
      'EnrollmentArea', 'EnrollmentSubject', 'EnrollmentDimension', 'EnrollmentEvent',
      'StudentGrade', 'PeriodFinalGrade', 'PartialGrade', 'FinalComponentGrade',
      'PreventiveAlert', 'AttendanceRecord', 'StudentObservation',
      'ObserverCommitment', 'GuardianCitation', 'ObserverReferral', 'PedagogicalMeasure',
      'PeriodRecovery', 'FinalRecoveryPlan', 'PerformanceManualEdit', 'StudentAchievement',
      'EvaluativeActivity', 'SubjectPerformance', 'Achievement', 'AttitudinalAchievement',
      'RoomRestriction'
    ])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', table_name) INTO null_count;
    IF null_count > 0 THEN
      RAISE WARNING '⚠️  % tiene % filas con institutionId NULL', table_name, null_count;
    ELSE
      RAISE NOTICE '✅ % — todas las filas tienen institutionId', table_name;
    END IF;
  END LOOP;
END $$;
