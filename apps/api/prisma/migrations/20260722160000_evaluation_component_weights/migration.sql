-- Fase 2: la estructura de evaluación de la institución (procesos y subprocesos)
-- pasa a vivir en EvaluationComponent, con su peso por defecto. Ese peso se hereda
-- al plan de evaluación de cada asignación, que es lo que sí calcula el boletín.
-- Antes el peso institucional vivía solo en gradingConfig.evaluationProcesses (JSON),
-- que el motor de notas ignoraba por completo.
--
-- Aditiva y no destructiva: solo agrega columnas opcionales.

ALTER TABLE "EvaluationComponent" ADD COLUMN IF NOT EXISTS "weightPercentage" INTEGER;
ALTER TABLE "EvaluationComponent" ADD COLUMN IF NOT EXISTS "order" INTEGER;
ALTER TABLE "EvaluationComponent" ADD COLUMN IF NOT EXISTS "allowTeacherAddGrades" BOOLEAN NOT NULL DEFAULT true;
