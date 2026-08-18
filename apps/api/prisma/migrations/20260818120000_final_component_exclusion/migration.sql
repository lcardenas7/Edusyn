-- Alcance de las fuentes de evaluación final (pruebas semestrales y similares).
--
-- Permite declarar que un FinalComponent NO aplica a un grado, o a una
-- asignatura concreta de un grado. Hasta ahora «no aplica» sólo podía
-- INFERIRSE de la ausencia de nota, lo cual es indistinguible de «al docente
-- le falta subirla» — el mismo proxy inestable que D-12 rechazó.
--
-- Migración ADITIVA y NO destructiva:
--   · Crea una tabla nueva. No toca ninguna existente.
--   · SIN backfill: la tabla nace vacía y vacía significa «todo aplica a todos»,
--     que es exactamente el comportamiento actual. Las instituciones que no
--     configuren nada no cambian en absoluto.
--   · No modifica ni una sola nota.
--
-- Escrita a mano, no con `migrate dev`: la generación automática arrastraría
-- las 8 sentencias de drift preexistentes, incluido un DROP INDEX de la UNIQUE
-- Achievement_code_teacherAssignmentId_key.

-- CreateTable
CREATE TABLE "FinalComponentExclusion" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "finalComponentId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalComponentExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FCE_component_grade_subject_key" ON "FinalComponentExclusion"("finalComponentId", "gradeId", "subjectId");
CREATE INDEX "FCE_component_idx" ON "FinalComponentExclusion"("finalComponentId");
CREATE INDEX "FCE_institution_idx" ON "FinalComponentExclusion"("institutionId");
CREATE INDEX "FCE_grade_idx" ON "FinalComponentExclusion"("gradeId");

-- CreateIndex (PARCIAL — no expresable en schema.prisma)
--
-- En PostgreSQL NULL != NULL dentro de un índice UNIQUE, así que el índice de
-- arriba NO impide dos filas con el mismo (componente, grado) y subjectId NULL.
-- No es teórico: ReportCardTemplateSelection declara @@unique([institutionId,
-- gradeId]) con gradeId anulable y hoy tiene 3 filas con gradeId = NULL para la
-- misma institución. Este índice parcial cierra ese agujero para la exclusión
-- «grado completo», que es la que se va a usar el 99 % de las veces.
CREATE UNIQUE INDEX "FCE_component_grade_all_key"
    ON "FinalComponentExclusion"("finalComponentId", "gradeId")
    WHERE "subjectId" IS NULL;

-- AddForeignKey
--
-- institución → RESTRICT: no se borra una institución que aún declara alcance
--   (misma política que las tablas de notas).
-- componente / grado / asignatura → CASCADE: si desaparece cualquiera de los
--   tres, la exclusión pierde su sujeto y no significa nada. No es historia
--   académica: es configuración, y se puede volver a declarar.
-- createdBy → SET NULL: la exclusión sobrevive a la baja del usuario que la creó.
ALTER TABLE "FinalComponentExclusion" ADD CONSTRAINT "FinalComponentExclusion_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalComponentExclusion" ADD CONSTRAINT "FinalComponentExclusion_finalComponentId_fkey" FOREIGN KEY ("finalComponentId") REFERENCES "FinalComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalComponentExclusion" ADD CONSTRAINT "FinalComponentExclusion_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalComponentExclusion" ADD CONSTRAINT "FinalComponentExclusion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalComponentExclusion" ADD CONSTRAINT "FinalComponentExclusion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS multi-tenant por tabla (patrón tenant-scoped, defensivo).
-- Obligatorio: `npm run check:rls` falla si una tabla con institutionId queda
-- sin RLS habilitado, FORZADO y con política.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "FinalComponentExclusion" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "FinalComponentExclusion" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'FinalComponentExclusion' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "FinalComponentExclusion" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
