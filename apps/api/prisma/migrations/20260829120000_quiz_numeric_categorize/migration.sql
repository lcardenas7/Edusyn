-- ============================================================================
-- Nuevos tipos de pregunta de quiz: NUMERIC y CATEGORIZE
-- Cambio 100% aditivo (seguro para producción): solo agrega valores al enum.
-- ============================================================================

ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'NUMERIC';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'CATEGORIZE';
