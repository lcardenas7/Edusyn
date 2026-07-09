-- Actividad "propia de una ruta" (Paso 2, increment 3d): marca isRouteScoped.
-- Creada dentro de un paso de ruta, se oculta de la pestaña Actividades; el
-- estudiante la hace desde el mapa de la ruta. 100% aditivo: 1 columna nueva.
-- docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md §13 (Paso 2)

ALTER TABLE "ClassroomActivity" ADD COLUMN "isRouteScoped" BOOLEAN NOT NULL DEFAULT false;
