-- Add missing column bulletinsReleasedForTeachers to AcademicTerm
ALTER TABLE "AcademicTerm" ADD COLUMN IF NOT EXISTS "bulletinsReleasedForTeachers" BOOLEAN NOT NULL DEFAULT false;
