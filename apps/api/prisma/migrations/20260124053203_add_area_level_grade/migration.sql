/*
  Warnings:

  - A unique constraint covering the columns `[institutionId,name,academicLevel,gradeId]` on the table `Area` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Area_institutionId_name_key";

-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "academicLevel" TEXT,
ADD COLUMN     "gradeId" TEXT;

-- CreateIndex
CREATE INDEX "Area_institutionId_academicLevel_idx" ON "Area"("institutionId", "academicLevel");

-- CreateIndex
CREATE INDEX "Area_institutionId_gradeId_idx" ON "Area"("institutionId", "gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Area_institutionId_name_academicLevel_gradeId_key" ON "Area"("institutionId", "name", "academicLevel", "gradeId");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
