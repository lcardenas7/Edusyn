/*
  Warnings:

  - You are about to drop the column `academicLevel` on the `Area` table. All the data in the column will be lost.
  - You are about to drop the column `calculationType` on the `Area` table. All the data in the column will be lost.
  - You are about to drop the column `customFormula` on the `Area` table. All the data in the column will be lost.
  - You are about to drop the column `gradeId` on the `Area` table. All the data in the column will be lost.
  - You are about to drop the column `isMandatory` on the `Area` table. All the data in the column will be lost.
  - You are about to drop the `SubjectLevelConfig` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[institutionId,name]` on the table `Area` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AcademicLevel" AS ENUM ('PREESCOLAR', 'PRIMARIA', 'SECUNDARIA', 'MEDIA', 'MEDIA_TECNICA', 'OTRO');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('MANDATORY', 'ELECTIVE', 'OPTIONAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "GroupExceptionType" AS ENUM ('EXCLUDE', 'INCLUDE', 'MODIFY');

-- DropForeignKey
ALTER TABLE "Area" DROP CONSTRAINT "Area_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "SubjectLevelConfig" DROP CONSTRAINT "SubjectLevelConfig_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "SubjectLevelConfig" DROP CONSTRAINT "SubjectLevelConfig_subjectId_fkey";

-- DropIndex
DROP INDEX "Area_institutionId_academicLevel_idx";

-- DropIndex
DROP INDEX "Area_institutionId_gradeId_idx";

-- DropIndex
DROP INDEX "Area_institutionId_name_academicLevel_gradeId_key";

-- AlterTable
ALTER TABLE "Area" DROP COLUMN "academicLevel",
DROP COLUMN "calculationType",
DROP COLUMN "customFormula",
DROP COLUMN "gradeId",
DROP COLUMN "isMandatory",
ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subjectType" "SubjectType" NOT NULL DEFAULT 'MANDATORY';

-- DropTable
DROP TABLE "SubjectLevelConfig";

-- CreateTable
CREATE TABLE "AcademicTemplate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" "AcademicLevel" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "achievementsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "useAttitudinalAchievement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateArea" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "weightPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculationType" "AreaCalculationType" NOT NULL DEFAULT 'AVERAGE',
    "approvalRule" "AreaApprovalRule" NOT NULL DEFAULT 'AREA_AVERAGE',
    "recoveryRule" "AreaRecoveryRule" NOT NULL DEFAULT 'INDIVIDUAL_SUBJECT',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSubject" (
    "id" TEXT NOT NULL,
    "templateAreaId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "weightPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDominant" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "achievementsPerPeriod" INTEGER,
    "useAttitudinalAchievement" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeTemplate" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSubjectException" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "type" "GroupExceptionType" NOT NULL,
    "weeklyHours" INTEGER,
    "weightPercentage" DOUBLE PRECISION,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSubjectException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicTemplate_institutionId_level_idx" ON "AcademicTemplate"("institutionId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTemplate_institutionId_name_key" ON "AcademicTemplate"("institutionId", "name");

-- CreateIndex
CREATE INDEX "TemplateArea_templateId_idx" ON "TemplateArea"("templateId");

-- CreateIndex
CREATE INDEX "TemplateArea_areaId_idx" ON "TemplateArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateArea_templateId_areaId_key" ON "TemplateArea"("templateId", "areaId");

-- CreateIndex
CREATE INDEX "TemplateSubject_templateAreaId_idx" ON "TemplateSubject"("templateAreaId");

-- CreateIndex
CREATE INDEX "TemplateSubject_subjectId_idx" ON "TemplateSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSubject_templateAreaId_subjectId_key" ON "TemplateSubject"("templateAreaId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeTemplate_gradeId_key" ON "GradeTemplate"("gradeId");

-- CreateIndex
CREATE INDEX "GradeTemplate_templateId_idx" ON "GradeTemplate"("templateId");

-- CreateIndex
CREATE INDEX "GroupSubjectException_groupId_idx" ON "GroupSubjectException"("groupId");

-- CreateIndex
CREATE INDEX "GroupSubjectException_subjectId_idx" ON "GroupSubjectException"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSubjectException_groupId_subjectId_key" ON "GroupSubjectException"("groupId", "subjectId");

-- CreateIndex
CREATE INDEX "Area_institutionId_idx" ON "Area"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Area_institutionId_name_key" ON "Area"("institutionId", "name");

-- AddForeignKey
ALTER TABLE "AcademicTemplate" ADD CONSTRAINT "AcademicTemplate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateArea" ADD CONSTRAINT "TemplateArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcademicTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateArea" ADD CONSTRAINT "TemplateArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSubject" ADD CONSTRAINT "TemplateSubject_templateAreaId_fkey" FOREIGN KEY ("templateAreaId") REFERENCES "TemplateArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSubject" ADD CONSTRAINT "TemplateSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTemplate" ADD CONSTRAINT "GradeTemplate_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTemplate" ADD CONSTRAINT "GradeTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcademicTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubjectException" ADD CONSTRAINT "GroupSubjectException_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubjectException" ADD CONSTRAINT "GroupSubjectException_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
