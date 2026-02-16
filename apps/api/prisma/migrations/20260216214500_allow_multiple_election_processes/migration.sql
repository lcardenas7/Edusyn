-- Drop unique constraint to allow multiple election processes per academic year
ALTER TABLE "ElectionProcess" DROP CONSTRAINT IF EXISTS "ElectionProcess_institutionId_academicYearId_key";

-- Add index for performance (if not exists)
CREATE INDEX IF NOT EXISTS "ElectionProcess_institutionId_academicYearId_idx" ON "ElectionProcess"("institutionId", "academicYearId");

-- Add new election types for teachers
ALTER TYPE "ElectionType" ADD VALUE IF NOT EXISTS 'REPRESENTANTE_DOCENTES';
ALTER TYPE "ElectionType" ADD VALUE IF NOT EXISTS 'COMITE_CONVIVENCIA_DOC';
