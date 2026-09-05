-- F-1 · Habilitacion institucional para que los docentes fijen la nota final de
-- periodo de sus propias asignaturas.
--
-- Desactivada por defecto de forma deliberada: hasta ahora el permiso era
-- abierto para cualquier docente, y ese permiso historico NO debe convertirse
-- en una autorizacion permanente implicita. Cada institucion debe activarla.
--
-- Aditiva: ninguna columna existente cambia, se renombra ni se elimina.
ALTER TABLE "Institution"
  ADD COLUMN IF NOT EXISTS "allowTeacherFinalGradeOverride" BOOLEAN NOT NULL DEFAULT false;
