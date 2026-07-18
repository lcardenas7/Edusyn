-- Etapa 3 · Bloque 1: reutilizar actividades/juegos existentes dentro de la Expedición.
-- Flag para distinguir una actividad REUTILIZADA (enlazada; NO se borra su ClassroomActivity
-- al quitarla de la misión) de una PROPIA (creada inline; sí se borra en cascada).
ALTER TABLE "AbpMissionActivity" ADD COLUMN "linkedActivity" BOOLEAN NOT NULL DEFAULT false;
