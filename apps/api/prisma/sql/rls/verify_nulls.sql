SELECT t.table_name, t.null_count
FROM (
  SELECT 'StudentEnrollment' as table_name, COUNT(*) as null_count FROM "StudentEnrollment" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'TeacherAssignment', COUNT(*) FROM "TeacherAssignment" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'EnrollmentArea', COUNT(*) FROM "EnrollmentArea" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'EnrollmentSubject', COUNT(*) FROM "EnrollmentSubject" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'EnrollmentDimension', COUNT(*) FROM "EnrollmentDimension" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'EnrollmentEvent', COUNT(*) FROM "EnrollmentEvent" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'StudentGrade', COUNT(*) FROM "StudentGrade" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'PeriodFinalGrade', COUNT(*) FROM "PeriodFinalGrade" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'PartialGrade', COUNT(*) FROM "PartialGrade" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'FinalComponentGrade', COUNT(*) FROM "FinalComponentGrade" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'PreventiveAlert', COUNT(*) FROM "PreventiveAlert" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'AttendanceRecord', COUNT(*) FROM "AttendanceRecord" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'StudentObservation', COUNT(*) FROM "StudentObservation" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'ObserverCommitment', COUNT(*) FROM "ObserverCommitment" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'GuardianCitation', COUNT(*) FROM "GuardianCitation" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'ObserverReferral', COUNT(*) FROM "ObserverReferral" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'PedagogicalMeasure', COUNT(*) FROM "PedagogicalMeasure" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'PeriodRecovery', COUNT(*) FROM "PeriodRecovery" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'FinalRecoveryPlan', COUNT(*) FROM "FinalRecoveryPlan" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'PerformanceManualEdit', COUNT(*) FROM "PerformanceManualEdit" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'StudentAchievement', COUNT(*) FROM "StudentAchievement" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'EvaluativeActivity', COUNT(*) FROM "EvaluativeActivity" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'SubjectPerformance', COUNT(*) FROM "SubjectPerformance" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'Achievement', COUNT(*) FROM "Achievement" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'AttitudinalAchievement', COUNT(*) FROM "AttitudinalAchievement" WHERE "institutionId" IS NULL
  UNION ALL SELECT 'RoomRestriction', COUNT(*) FROM "RoomRestriction" WHERE "institutionId" IS NULL
) t
WHERE t.null_count > 0;
