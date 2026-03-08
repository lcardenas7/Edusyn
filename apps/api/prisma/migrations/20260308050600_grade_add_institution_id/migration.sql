-- ============================================================================
-- MIGRACIÓN: Agregar institutionId a Grade para aislamiento multi-tenant
-- ============================================================================
-- PROBLEMA: Grade era una tabla global sin institutionId, lo que causaba que
-- instituciones vieran grados de otras instituciones.
-- SOLUCIÓN: Agregar institutionId a Grade, rellenar con datos existentes,
-- y actualizar constraints.
-- ============================================================================

-- 1. Agregar columna nullable primero (seguro en producción)
ALTER TABLE "Grade" ADD COLUMN "institutionId" TEXT;

-- 2. Rellenar institutionId basado en los grupos existentes del grado
-- (cada grupo pertenece a un campus que tiene institutionId)
UPDATE "Grade" g
SET "institutionId" = (
  SELECT DISTINCT c."institutionId"
  FROM "Group" gr
  JOIN "Campus" c ON gr."campusId" = c."id"
  WHERE gr."gradeId" = g."id"
  LIMIT 1
);

-- 3. Para grados huérfanos (sin grupos), asignar la primera institución existente
-- Estos grados no pertenecen a nadie, pero necesitan un dueño para NOT NULL
UPDATE "Grade"
SET "institutionId" = (SELECT "id" FROM "Institution" LIMIT 1)
WHERE "institutionId" IS NULL;

-- 4. Si aún hay NULLs (no hay instituciones), fallar explícitamente
-- Esto no debería ocurrir en producción
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Grade" WHERE "institutionId" IS NULL) THEN
    RAISE EXCEPTION 'Hay grados sin institutionId después de la migración. Revisar datos.';
  END IF;
END $$;

-- 5. Hacer la columna NOT NULL
ALTER TABLE "Grade" ALTER COLUMN "institutionId" SET NOT NULL;

-- 6. Agregar FK
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Eliminar old unique constraint y crear la nueva con institutionId
ALTER TABLE "Grade" DROP CONSTRAINT IF EXISTS "Grade_stage_name_key";
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_institutionId_stage_name_key" UNIQUE ("institutionId", "stage", "name");

-- 8. Agregar índice para performance
CREATE INDEX "Grade_institutionId_idx" ON "Grade"("institutionId");

-- 9. Duplicar grados compartidos: si un grado tiene grupos de múltiples instituciones,
-- crear copias del grado para cada institución adicional y reasignar sus grupos.
-- NOTA: El paso 2 asignó el grado a UNA institución. Si otras instituciones también
-- tienen grupos en ese grado, necesitamos crear copias.
DO $$
DECLARE
  rec RECORD;
  new_grade_id TEXT;
BEGIN
  -- Encontrar grados que tienen grupos de instituciones diferentes a su institutionId
  FOR rec IN
    SELECT DISTINCT g."id" AS grade_id, g."stage", g."number", g."name",
           g."academicStructure", g."institutionId" AS owner_inst,
           c."institutionId" AS other_inst
    FROM "Grade" g
    JOIN "Group" gr ON gr."gradeId" = g."id"
    JOIN "Campus" c ON gr."campusId" = c."id"
    WHERE c."institutionId" != g."institutionId"
  LOOP
    -- Verificar si ya existe un grado con ese nombre para esa institución
    SELECT "id" INTO new_grade_id
    FROM "Grade"
    WHERE "institutionId" = rec.other_inst
      AND "stage" = rec.stage
      AND "name" = rec.name;

    -- Si no existe, crear copia del grado para la otra institución
    IF new_grade_id IS NULL THEN
      new_grade_id := gen_random_uuid()::text;
      -- Usar formato cuid-like: prefijo 'c' + random
      new_grade_id := 'c' || replace(gen_random_uuid()::text, '-', '');
      new_grade_id := substring(new_grade_id from 1 for 25);

      INSERT INTO "Grade" ("id", "institutionId", "stage", "number", "name", "academicStructure", "createdAt", "updatedAt")
      VALUES (new_grade_id, rec.other_inst, rec.stage, rec.number, rec.name, rec.academicStructure, now(), now());
    END IF;

    -- Reasignar grupos de esa institución al nuevo grado
    UPDATE "Group" gr
    SET "gradeId" = new_grade_id
    FROM "Campus" c
    WHERE gr."campusId" = c."id"
      AND c."institutionId" = rec.other_inst
      AND gr."gradeId" = rec.grade_id;
  END LOOP;
END $$;
