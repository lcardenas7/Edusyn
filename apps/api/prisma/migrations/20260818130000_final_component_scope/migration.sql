-- D-19 · Alcance de las fuentes de evaluación final (pruebas semestrales).
--
-- Permite declarar qué grados —y opcionalmente qué asignaturas de un grado—
-- presentan una fuente final. Hasta ahora «no aplica» sólo podía INFERIRSE de
-- que no hubiera nota, y eso es indistinguible de «al docente le falta
-- subirla»: el mismo proxy inestable que D-12 rechazó.
--
-- ESTRICTAMENTE ADITIVA:
--   · Un enum nuevo.
--   · Una columna con DEFAULT en FinalComponent: las filas existentes heredan
--     ALL_GRADES sin ejecutar un solo UPDATE, así que conservan exactamente su
--     comportamiento actual.
--   · Una tabla nueva que nace VACÍA. Sin backfill.
--   · Cero DELETE, cero DROP, cero TRUNCATE, cero modificación de notas.
--
-- REVERSIBILIDAD: DROP TABLE + DROP COLUMN + DROP TYPE. No hay nada que
-- restaurar porque no se destruye nada.
--
-- Escrita a mano, no con `migrate dev`: la generación automática arrastraría
-- las 8 sentencias de drift preexistentes, incluido un DROP INDEX de la UNIQUE
-- Achievement_code_teacherAssignmentId_key.
--
-- NOTA sobre 20260818120000_final_component_exclusion: aquella migración quedó
-- en el historial de la rama pero NUNCA llegó a aplicarse en ningún motor
-- (verificado en staging y producción: 89 migraciones, sin rastro de la tabla).
-- Se retira del repositorio y la sustituye ésta, con el modelo definitivo.

-- CreateEnum
CREATE TYPE "FinalComponentScopeMode" AS ENUM ('ALL_GRADES', 'SELECTED_GRADES');

-- AlterTable · DEFAULT para no tocar ninguna fila existente
ALTER TABLE "FinalComponent"
  ADD COLUMN "scopeMode" "FinalComponentScopeMode" NOT NULL DEFAULT 'ALL_GRADES';

-- CreateTable
CREATE TABLE "FinalComponentScope" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "finalComponentId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT,
    "applies" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalComponentScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FCS_component_grade_subject_key" ON "FinalComponentScope"("finalComponentId", "gradeId", "subjectId");
CREATE INDEX "FCS_component_idx" ON "FinalComponentScope"("finalComponentId");
CREATE INDEX "FCS_institution_idx" ON "FinalComponentScope"("institutionId");
CREATE INDEX "FCS_grade_idx" ON "FinalComponentScope"("gradeId");

-- CreateIndex (PARCIAL — no expresable en schema.prisma)
--
-- En PostgreSQL NULL != NULL dentro de un índice UNIQUE, así que el índice de
-- arriba NO impide dos filas con el mismo (componente, grado) y subjectId NULL.
-- No es teórico: ReportCardTemplateSelection declara @@unique([institutionId,
-- gradeId]) con gradeId anulable y hoy tiene 3 filas con gradeId = NULL para la
-- misma institución. Este índice cierra ese agujero para la regla «grado
-- completo», que es la que se usará la mayoría de las veces.
CREATE UNIQUE INDEX "FCS_component_grade_all_key"
    ON "FinalComponentScope"("finalComponentId", "gradeId")
    WHERE "subjectId" IS NULL;

-- AddForeignKey
--
-- institución → RESTRICT: no se borra una institución que aún declara alcance
--   (misma política que las tablas de notas).
-- componente / grado / asignatura → CASCADE: si desaparece cualquiera de los
--   tres, la regla pierde su sujeto y no significa nada. Es CONFIGURACIÓN, no
--   historia académica: se puede volver a declarar.
-- createdBy → SET NULL: la regla sobrevive a la baja del usuario que la creó.
ALTER TABLE "FinalComponentScope" ADD CONSTRAINT "FinalComponentScope_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalComponentScope" ADD CONSTRAINT "FinalComponentScope_finalComponentId_fkey" FOREIGN KEY ("finalComponentId") REFERENCES "FinalComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalComponentScope" ADD CONSTRAINT "FinalComponentScope_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalComponentScope" ADD CONSTRAINT "FinalComponentScope_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalComponentScope" ADD CONSTRAINT "FinalComponentScope_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS multi-tenant (patrón tenant-scoped, defensivo).
-- Obligatorio: `npm run check:rls` falla si una tabla con institutionId queda
-- sin RLS habilitado, FORZADO y con política.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "FinalComponentScope" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "FinalComponentScope" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'FinalComponentScope' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "FinalComponentScope" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
