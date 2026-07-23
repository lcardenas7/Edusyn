-- Elimina el índice único GLOBAL obsoleto sobre Grade(stage, name).
--
-- Contexto: la migración 20260308050600 quiso reemplazarlo por el correcto
-- Grade_institutionId_stage_name_key, pero usó `DROP CONSTRAINT IF EXISTS
-- "Grade_stage_name_key"` sobre un objeto que en realidad es un ÍNDICE único
-- (no un constraint), así que fue un no-op silencioso y el índice global sobrevivió.
--
-- Efecto del bug: dos instituciones NO podían compartir el mismo (stage, name), y
-- renombrar/crear un grado fallaba con "Unique constraint failed on (stage, name)"
-- si otra institución ya usaba ese nombre. El único válido es el scopeado por
-- institución (Grade_institutionId_stage_name_key), que permanece intacto.
--
-- Idempotente y seguro: cubre ambos casos (constraint o índice suelto).

ALTER TABLE "Grade" DROP CONSTRAINT IF EXISTS "Grade_stage_name_key";
DROP INDEX IF EXISTS "Grade_stage_name_key";
