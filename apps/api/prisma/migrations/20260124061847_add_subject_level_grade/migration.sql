/*
  Warnings:

  - A unique constraint covering the columns `[areaId,name,academicLevel,gradeId]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Subject_areaId_name_key";

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "academicLevel" TEXT,
ADD COLUMN     "gradeId" TEXT;

-- CreateIndex
CREATE INDEX "Subject_areaId_academicLevel_idx" ON "Subject"("areaId", "academicLevel");

-- CreateIndex
CREATE INDEX "Subject_areaId_gradeId_idx" ON "Subject"("areaId", "gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_areaId_name_academicLevel_gradeId_key" ON "Subject"("areaId", "name", "academicLevel", "gradeId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
