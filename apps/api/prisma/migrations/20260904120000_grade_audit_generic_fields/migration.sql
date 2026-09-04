-- Auditoria de notas: campos aditivos para cubrir los origenes distintos de la
-- nota parcial. Ninguna columna existente cambia de tipo, se renombra ni se
-- elimina, de modo que lo ya registrado sigue siendo legible.

-- Identificador generico del registro afectado. `partialGradeId` solo sirve
-- para el origen PARTIAL_GRADE; los demas origenes escriben en `recordId`.
ALTER TABLE "GradeAuditEvent" ADD COLUMN IF NOT EXISTS "recordId" TEXT;

-- Motivo declarado por el actor, exigido solo donde el gobierno del ciclo de
-- periodo lo requiera.
ALTER TABLE "GradeAuditEvent" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- Correlacion de lote: una escritura masiva emite un evento por estudiante y
-- todos comparten este identificador.
ALTER TABLE "GradeAuditEvent" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

-- Identificadores propios de cada origen. No se reutiliza `componentType`,
-- que en la nota parcial significa otra cosa.
ALTER TABLE "GradeAuditEvent" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "GradeAuditEvent" ADD COLUMN IF NOT EXISTS "finalComponentId" TEXT;
ALTER TABLE "GradeAuditEvent" ADD COLUMN IF NOT EXISTS "evaluativeActivityId" TEXT;

CREATE INDEX IF NOT EXISTS "GradeAuditEvent_batchId_idx" ON "GradeAuditEvent"("batchId");
