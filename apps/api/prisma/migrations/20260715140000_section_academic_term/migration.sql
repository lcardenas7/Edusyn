-- Período académico OPCIONAL en las secciones del aula: permite categorizar el
-- contenido por período. 100% aditivo: 1 columna nullable + índice + FK con SET NULL
-- (si se borra el período, la sección sobrevive sin período). No toca nada existente.

ALTER TABLE "ClassroomSection" ADD COLUMN "academicTermId" TEXT;

CREATE INDEX "ClassroomSection_academicTermId_idx" ON "ClassroomSection"("academicTermId");

ALTER TABLE "ClassroomSection" ADD CONSTRAINT "ClassroomSection_academicTermId_fkey"
  FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
