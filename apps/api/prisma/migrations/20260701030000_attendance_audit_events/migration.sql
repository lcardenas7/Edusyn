-- Auditoría forense de asistencia (append-only). 100% aditivo: tabla nueva.
-- Reutiliza el enum GradeAuditAction ya existente. No toca AttendanceRecord. Cero downtime.

-- CreateTable
CREATE TABLE "AttendanceAuditEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "action" "GradeAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "attendanceRecordId" TEXT,
    "studentEnrollmentId" TEXT,
    "teacherAssignmentId" TEXT,
    "date" DATE,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceAuditEvent_institutionId_performedAt_idx" ON "AttendanceAuditEvent"("institutionId", "performedAt");
CREATE INDEX "AttendanceAuditEvent_studentEnrollmentId_idx" ON "AttendanceAuditEvent"("studentEnrollmentId");
CREATE INDEX "AttendanceAuditEvent_teacherAssignmentId_idx" ON "AttendanceAuditEvent"("teacherAssignmentId");
CREATE INDEX "AttendanceAuditEvent_actorUserId_idx" ON "AttendanceAuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "AttendanceAuditEvent" ADD CONSTRAINT "AttendanceAuditEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto de tablas tenant-scoped.
-- Defensivo: solo se aplica si la función current_institution_id() existe (entornos con RLS configurada).
-- En entornos sin RLS (p.ej. staging), se omite sin fallar y el aislamiento queda a nivel de aplicación.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AttendanceAuditEvent" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AttendanceAuditEvent" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AttendanceAuditEvent' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AttendanceAuditEvent" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
