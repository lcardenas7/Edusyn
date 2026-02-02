/*
  Warnings:

  - A unique constraint covering the columns `[institutionId,academicYearId,name]` on the table `AcademicTemplate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gradeId,academicYearId]` on the table `GradeTemplate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[groupId,subjectId,academicYearId]` on the table `GroupSubjectException` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYearId` to the `AcademicTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicYearId` to the `GradeTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicYearId` to the `GroupSubjectException` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AcademicTemplate_institutionId_level_idx";

-- DropIndex
DROP INDEX "AcademicTemplate_institutionId_name_key";

-- DropIndex
DROP INDEX "GradeTemplate_gradeId_key";

-- DropIndex
DROP INDEX "GroupSubjectException_groupId_subjectId_key";

-- AlterTable
ALTER TABLE "AcademicTemplate" ADD COLUMN     "academicYearId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GradeTemplate" ADD COLUMN     "academicYearId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GroupSubjectException" ADD COLUMN     "academicYearId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AcademicTemplate_institutionId_academicYearId_level_idx" ON "AcademicTemplate"("institutionId", "academicYearId", "level");

-- CreateIndex
CREATE INDEX "AcademicTemplate_academicYearId_idx" ON "AcademicTemplate"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTemplate_institutionId_academicYearId_name_key" ON "AcademicTemplate"("institutionId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "GradeTemplate_academicYearId_idx" ON "GradeTemplate"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeTemplate_gradeId_academicYearId_key" ON "GradeTemplate"("gradeId", "academicYearId");

-- CreateIndex
CREATE INDEX "GroupSubjectException_academicYearId_idx" ON "GroupSubjectException"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSubjectException_groupId_subjectId_academicYearId_key" ON "GroupSubjectException"("groupId", "subjectId", "academicYearId");

-- AddForeignKey
ALTER TABLE "AcademicTemplate" ADD CONSTRAINT "AcademicTemplate_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTemplate" ADD CONSTRAINT "GradeTemplate_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubjectException" ADD CONSTRAINT "GroupSubjectException_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
