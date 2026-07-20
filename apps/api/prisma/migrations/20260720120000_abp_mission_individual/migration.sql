-- Misiones INDIVIDUALES dentro del ABP: el docente dirige una misión a UN
-- integrante ("Juan, tú entrevista al encargado"). Lo que hoy ocurre por WhatsApp
-- queda integrado y trazable. Aditiva y sin pérdida: todas las misiones existentes
-- quedan como TEAM (comportamiento actual intacto).

ALTER TABLE "AbpMission"
  ADD COLUMN IF NOT EXISTS "assigneeType"         TEXT NOT NULL DEFAULT 'TEAM',
  ADD COLUMN IF NOT EXISTS "assigneeEnrollmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "assigneeName"         TEXT,
  ADD COLUMN IF NOT EXISTS "dueAt"                TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AbpMission_assigneeEnrollmentId_idx"
  ON "AbpMission"("assigneeEnrollmentId");
