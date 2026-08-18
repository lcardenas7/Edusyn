-- F2 · Relaciones de alcance de StudentEvidenceValuation.
--
-- Cierra el hallazgo H-2: la tabla no cascadeaba al borrar una matrícula, un período
-- o una institución, porque no tenía ninguna clave foránea hacia ellos.
--
-- Las políticas NO se eligieron: se derivaron de las cinco tablas de historia
-- académica del sistema (StudentAchievement, PeriodFinalGrade, PartialGrade,
-- ConvivenciaEntry, TermReportCardSnapshot).
--   · matrícula y período → CASCADE en las cinco, sin excepción.
--   · institución         → RESTRICT, como las tres tablas de notas.
--
-- Precondición verificada antes de aplicar: 0 huérfanos en las tres relaciones.
-- Migración ADITIVA y exclusivamente estructural. No crea índices (las tres columnas
-- ya están cubiertas). No toca datos. No modifica la FK de achievementEvidenceId,
-- que permanece RESTRICT/RESTRICT. No resuelve el drift de índices preexistente.

-- AddForeignKey
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
