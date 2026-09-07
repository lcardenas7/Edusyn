-- Trazabilidad de la EMISIÓN de boletines — "cero cambios silenciosos".
--
-- Responde a una decisión cerrada del rector (2026-08-27): debe quedar registro de cuándo se
-- exportaron los boletines, quién lo hizo y sobre quién. Hasta ahora `generateReportCardPdf` y
-- `generateBulkReportCards` no dejaban ningún rastro.
--
-- Rediseñada sobre el Edusyn vigente. NO reutiliza `20260827120000_report_card_traceability`,
-- que quedó huérfana en una rama local: aquella traía además una auditoría cualitativa que el
-- staging actual ya resuelve por otro camino (`GradeAuditEvent` con source ACHIEVEMENT_EVIDENCE).
-- Aquí solo viaja la pieza que de verdad falta.
--
-- ESTRICTAMENTE ADITIVA Y FORWARD-ONLY:
--   · Un enum nuevo y una tabla nueva que nace VACÍA. Sin backfill.
--   · Cero DELETE, cero DROP, cero TRUNCATE, cero modificación de datos académicos.
--   · Ninguna tabla existente cambia de forma.
--
-- REVERSIBILIDAD: DROP TABLE + DROP TYPE. Nada más que deshacer.

-- CreateEnum
CREATE TYPE "ReportCardGenerationAction" AS ENUM ('SINGLE_PDF', 'BULK_PDF');

-- CreateTable
CREATE TABLE "ReportCardGenerationEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "action" "ReportCardGenerationAction" NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "studentEnrollmentId" TEXT,
    "academicTermId" TEXT,
    "groupId" TEXT,
    "batchId" TEXT,
    "studentCount" INTEGER,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "detail" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardGenerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCardGenerationEvent_institutionId_idx" ON "ReportCardGenerationEvent"("institutionId");
CREATE INDEX "ReportCardGenerationEvent_academicTermId_idx" ON "ReportCardGenerationEvent"("academicTermId");
CREATE INDEX "ReportCardGenerationEvent_studentEnrollmentId_idx" ON "ReportCardGenerationEvent"("studentEnrollmentId");
CREATE INDEX "ReportCardGenerationEvent_performedAt_idx" ON "ReportCardGenerationEvent"("performedAt");
CREATE INDEX "ReportCardGenerationEvent_institutionId_action_idx" ON "ReportCardGenerationEvent"("institutionId", "action");
CREATE INDEX "ReportCardGenerationEvent_batchId_idx" ON "ReportCardGenerationEvent"("batchId");

-- AddForeignKey
ALTER TABLE "ReportCardGenerationEvent" ADD CONSTRAINT "ReportCardGenerationEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto de tablas
-- tenant-scoped, copiado literalmente de 20260630170000_grade_audit_events.
--
-- ⚠️ DEUDA CONOCIDA, documentada como RLS_REPRODUCIBILITY_DEBT: este bloque es CONDICIONAL. Solo
-- aplica si `current_institution_id()` ya existe, y NINGUNA migración del historial crea esa
-- función. En una base reconstruida solo con migraciones, esta tabla nace SIN RLS y su aislamiento
-- queda a nivel de aplicación (el interceptor de tenant filtra por institutionId).
--
-- No se resuelve aquí a propósito: es otra fase. Se replica el patrón vigente para no introducir
-- una tercera forma de hacer lo mismo.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "ReportCardGenerationEvent" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "ReportCardGenerationEvent" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ReportCardGenerationEvent' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "ReportCardGenerationEvent" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
