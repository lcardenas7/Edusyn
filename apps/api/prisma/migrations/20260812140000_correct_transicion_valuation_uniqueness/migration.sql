-- Corrección segura de la migración de Transición.
-- No borra filas: exige que toda valoración existente tenga período antes de
-- retirar el índice único antiguo, que impedía una valoración por período.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "StudentAchievement" WHERE "academicTermId" IS NULL) THEN
    RAISE EXCEPTION 'No se puede exigir academicTermId: existen valoraciones sin período. Corrija el backfill antes de reintentar.';
  END IF;
END$$;

ALTER TABLE "StudentAchievement"
  ALTER COLUMN "academicTermId" SET NOT NULL;

-- La migración base creó este unique como índice, no como constraint; por eso
-- DROP CONSTRAINT no lo retiró. Se elimina únicamente la restricción de esquema,
-- después de comprobar que la nueva clave completa protege todos los registros.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAchievement_studentEnrollmentId_achievementId_key') THEN
    ALTER TABLE "StudentAchievement" DROP CONSTRAINT "StudentAchievement_studentEnrollmentId_achievementId_key";
  END IF;
END$$;
DROP INDEX IF EXISTS "StudentAchievement_studentEnrollmentId_achievementId_key";

-- Evita duplicar propósitos compartidos en el catálogo de grado/dimensión/año.
CREATE UNIQUE INDEX IF NOT EXISTS "Achievement_gradeId_subjectId_academicYearId_orderNumber_isPromotional_key"
  ON "Achievement"("gradeId", "subjectId", "academicYearId", "orderNumber", "isPromotional");
