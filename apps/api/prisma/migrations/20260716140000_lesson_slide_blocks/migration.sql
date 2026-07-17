-- Motor de bloques: array de bloques tipados por slide (Motor de Lecciones).
-- 100% aditivo; las slides viejas siguen con render legacy hasta re-guardarse.

ALTER TABLE "LessonSlide" ADD COLUMN "blocks" JSONB;
