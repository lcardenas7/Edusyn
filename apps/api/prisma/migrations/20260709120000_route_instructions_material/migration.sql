-- Indicaciones del docente + material base en la ruta. Valeria los usa al armar la
-- ruta y los REUSA al generar la lección de cada paso (coherencia en toda la ruta).
-- 100% aditivo: 2 columnas nullable. No toca nada existente.

ALTER TABLE "LearningRoute" ADD COLUMN "instructions" TEXT;
ALTER TABLE "LearningRoute" ADD COLUMN "sourceMaterial" TEXT;
