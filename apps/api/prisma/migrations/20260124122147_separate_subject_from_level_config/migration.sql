/*
  Warnings:

  - You are about to drop the column `academicLevel` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `gradeId` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `isDominant` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `weeklyHours` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Subject` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[areaId,name]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_gradeId_fkey";

-- DropIndex
DROP INDEX "Subject_areaId_academicLevel_idx";

-- DropIndex
DROP INDEX "Subject_areaId_gradeId_idx";

-- DropIndex
DROP INDEX "Subject_areaId_name_academicLevel_gradeId_key";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "academicLevel",
DROP COLUMN "gradeId",
DROP COLUMN "isDominant",
DROP COLUMN "weeklyHours",
DROP COLUMN "weight";

-- CreateTable
CREATE TABLE "SubjectLevelConfig" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isDominant" BOOLEAN NOT NULL DEFAULT false,
    "academicLevel" TEXT,
    "gradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectLevelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectLevelConfig_subjectId_idx" ON "SubjectLevelConfig"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectLevelConfig_academicLevel_idx" ON "SubjectLevelConfig"("academicLevel");

-- CreateIndex
CREATE INDEX "SubjectLevelConfig_gradeId_idx" ON "SubjectLevelConfig"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectLevelConfig_subjectId_academicLevel_gradeId_key" ON "SubjectLevelConfig"("subjectId", "academicLevel", "gradeId");

-- CreateIndex
CREATE INDEX "Subject_areaId_idx" ON "Subject"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_areaId_name_key" ON "Subject"("areaId", "name");

-- AddForeignKey
ALTER TABLE "SubjectLevelConfig" ADD CONSTRAINT "SubjectLevelConfig_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectLevelConfig" ADD CONSTRAINT "SubjectLevelConfig_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
