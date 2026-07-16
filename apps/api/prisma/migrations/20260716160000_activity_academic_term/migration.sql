-- Período académico OPCIONAL y DIRECTO en la actividad: puede vivir en un período
-- sin sección. 100% aditivo (columna nullable + índice + FK SetNull).

ALTER TABLE "ClassroomActivity" ADD COLUMN "academicTermId" TEXT;

CREATE INDEX "ClassroomActivity_academicTermId_idx" ON "ClassroomActivity"("academicTermId");

ALTER TABLE "ClassroomActivity" ADD CONSTRAINT "ClassroomActivity_academicTermId_fkey"
  FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
