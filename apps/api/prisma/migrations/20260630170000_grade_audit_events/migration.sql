-- Auditoría forense de notas (append-only). 100% aditivo: tabla + enum nuevos.
-- No toca PartialGrade ni ninguna tabla existente. Cero downtime.

-- CreateEnum
CREATE TYPE "GradeAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "GradeAuditEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PARTIAL_GRADE',
    "action" "GradeAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "partialGradeId" TEXT,
    "studentEnrollmentId" TEXT,
    "teacherAssignmentId" TEXT,
    "academicTermId" TEXT,
    "componentType" TEXT,
    "activityIndex" INTEGER,
    "activityName" TEXT,
    "previousScore" DECIMAL(5,2),
    "newScore" DECIMAL(5,2),
    "previousValue" JSONB,
    "newValue" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeAuditEvent_institutionId_performedAt_idx" ON "GradeAuditEvent"("institutionId", "performedAt");
CREATE INDEX "GradeAuditEvent_studentEnrollmentId_idx" ON "GradeAuditEvent"("studentEnrollmentId");
CREATE INDEX "GradeAuditEvent_teacherAssignmentId_academicTermId_idx" ON "GradeAuditEvent"("teacherAssignmentId", "academicTermId");
CREATE INDEX "GradeAuditEvent_actorUserId_idx" ON "GradeAuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "GradeAuditEvent" ADD CONSTRAINT "GradeAuditEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto de tablas tenant-scoped.
-- Defensivo: solo se aplica si la función current_institution_id() existe (entornos con RLS configurada).
-- En entornos sin RLS (p.ej. staging), se omite sin fallar y el aislamiento queda a nivel de aplicación.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "GradeAuditEvent" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "GradeAuditEvent" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'GradeAuditEvent' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "GradeAuditEvent" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
