-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Aislamiento multi-tenant por institutionId
-- ============================================================================
-- Fase 1: ENABLE RLS (sin FORCE) → protege PostgREST (anon/authenticated)
--         postgres (Prisma) bypasses RLS por defecto como table owner.
-- Fase 2: El backend seteará app.current_institution por request.
-- Fase 3 (futuro): ALTER TABLE ... FORCE ROW LEVEL SECURITY para máximo aislamiento.
-- ============================================================================

-- Función helper para obtener el tenant actual de forma segura
CREATE OR REPLACE FUNCTION current_institution_id() RETURNS text AS $$
  SELECT coalesce(nullif(current_setting('app.current_institution', true), ''), '__none__');
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- Habilitar RLS y crear políticas en TODAS las tablas con institutionId
-- ============================================================================

-- 1. InstitutionModule
ALTER TABLE "InstitutionModule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InstitutionModule" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 2. InstitutionUser
ALTER TABLE "InstitutionUser" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InstitutionUser" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 3. Campus
ALTER TABLE "Campus" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Campus" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 4. Area
ALTER TABLE "Area" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Area" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 5. AcademicTemplate
ALTER TABLE "AcademicTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AcademicTemplate" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 6. AcademicYear
ALTER TABLE "AcademicYear" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AcademicYear" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 7. PerformanceScale
ALTER TABLE "PerformanceScale" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PerformanceScale" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 8. EvaluationComponent
ALTER TABLE "EvaluationComponent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "EvaluationComponent" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 9. Student
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Student" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 10. Guardian
ALTER TABLE "Guardian" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Guardian" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 11. FinalComponent
ALTER TABLE "FinalComponent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinalComponent" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 12. Message
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Message" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 13. Announcement
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Announcement" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 15. GalleryImage
ALTER TABLE "GalleryImage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "GalleryImage" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 16. Event
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Event" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 17. RecoveryConfig
ALTER TABLE "RecoveryConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "RecoveryConfig" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 18. AcademicAct
ALTER TABLE "AcademicAct" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AcademicAct" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 19. PerformanceLevelComplement
ALTER TABLE "PerformanceLevelComplement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PerformanceLevelComplement" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 20. PerformanceConfig
ALTER TABLE "PerformanceConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PerformanceConfig" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 21. AchievementConfig
ALTER TABLE "AchievementConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AchievementConfig" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 22. AchievementBank
ALTER TABLE "AchievementBank" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AchievementBank" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 23. PermissionAuditLog
ALTER TABLE "PermissionAuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PermissionAuditLog" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 24. ElectionProcess
ALTER TABLE "ElectionProcess" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ElectionProcess" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 25. PaymentConcept
ALTER TABLE "PaymentConcept" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PaymentConcept" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 26. PaymentEvent
ALTER TABLE "PaymentEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PaymentEvent" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 27. InstitutionalDocument
ALTER TABLE "InstitutionalDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InstitutionalDocument" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 28. ManagementLeader
ALTER TABLE "ManagementLeader" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ManagementLeader" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 29. ManagementTask
ALTER TABLE "ManagementTask" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ManagementTask" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 30. InstitutionStorageUsage
ALTER TABLE "InstitutionStorageUsage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InstitutionStorageUsage" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 31. FinancialThirdParty
ALTER TABLE "FinancialThirdParty" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialThirdParty" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 32. FinancialCategory
ALTER TABLE "FinancialCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialCategory" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 33. ChargeConcept
ALTER TABLE "ChargeConcept" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ChargeConcept" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 34. FinancialObligation
ALTER TABLE "FinancialObligation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialObligation" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 35. FinancialPayment
ALTER TABLE "FinancialPayment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialPayment" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 36. FinancialExpense
ALTER TABLE "FinancialExpense" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialExpense" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 37. FinancialInvoice
ALTER TABLE "FinancialInvoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialInvoice" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 38. FinancialSettings
ALTER TABLE "FinancialSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FinancialSettings" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 39. CashRegisterClose
ALTER TABLE "CashRegisterClose" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CashRegisterClose" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 40. TimeBlock
ALTER TABLE "TimeBlock" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TimeBlock" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 41. Room
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Room" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 42. ScheduleGradeConfig
ALTER TABLE "ScheduleGradeConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ScheduleGradeConfig" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 43. TeacherAvailability
ALTER TABLE "TeacherAvailability" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TeacherAvailability" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 44. ScheduleEntry
ALTER TABLE "ScheduleEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ScheduleEntry" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 45. ReportCardConfig
ALTER TABLE "ReportCardConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ReportCardConfig" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- 46. InstitutionRoleCapability
ALTER TABLE "InstitutionRoleCapability" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "InstitutionRoleCapability" FOR ALL
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

-- ============================================================================
-- Tabla Institution: política especial (usa id, no institutionId)
-- ============================================================================
ALTER TABLE "Institution" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Institution" FOR ALL
  USING ("id" = current_institution_id())
  WITH CHECK ("id" = current_institution_id());

-- ============================================================================
-- Tablas sin institutionId directo pero con datos sensibles
-- Se protegen a través de las relaciones (JOINs) en futuras fases.
-- Por ahora quedan protegidas por el backend.
-- Ejemplo: StudentEnrollment → AcademicYear.institutionId
--          PartialGrade → TeacherAssignment → (no tiene institutionId directo)
-- ============================================================================

-- ============================================================================
-- NOTA: Las políticas usan current_institution_id() que lee
-- current_setting('app.current_institution', true).
-- El backend debe ejecutar SET app.current_institution = '<uuid>' por request.
-- Sin FORCE ROW LEVEL SECURITY, el rol postgres (Prisma) bypasses RLS.
-- Fase 3: agregar FORCE para máximo aislamiento.
-- ============================================================================
