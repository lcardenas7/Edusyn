/*
  Warnings:

  - You are about to drop the column `calendarType` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `numberOfPeriods` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `periodsWeight` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `semesterExamWeight` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `useSemesterExams` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `weightPercentage` on the `Period` table. All the data in the column will be lost.
  - You are about to drop the `CustomPerformanceLevel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EvaluationProcess` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EvaluationSubprocess` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GradingScaleConfig` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Institution` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Institution` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SystemModule" AS ENUM ('ACADEMIC', 'ATTENDANCE', 'EVALUATION', 'RECOVERY', 'REPORTS', 'COMMUNICATIONS', 'OBSERVER', 'PERFORMANCE', 'MEN_REPORTS', 'DASHBOARD');

-- DropForeignKey
ALTER TABLE "CustomPerformanceLevel" DROP CONSTRAINT "CustomPerformanceLevel_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "EvaluationProcess" DROP CONSTRAINT "EvaluationProcess_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "EvaluationSubprocess" DROP CONSTRAINT "EvaluationSubprocess_processId_fkey";

-- DropForeignKey
ALTER TABLE "GradingScaleConfig" DROP CONSTRAINT "GradingScaleConfig_institutionId_fkey";

-- AlterTable
ALTER TABLE "AcademicYear" DROP COLUMN "calendarType",
DROP COLUMN "numberOfPeriods",
DROP COLUMN "periodsWeight",
DROP COLUMN "semesterExamWeight",
DROP COLUMN "status",
DROP COLUMN "useSemesterExams";

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "status" "InstitutionStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- Update existing institutions with a default slug based on their id
UPDATE "Institution" SET "slug" = LOWER(REPLACE("name", ' ', '-')) || '-' || SUBSTRING("id", 1, 8) WHERE "slug" IS NULL;

-- Now make slug NOT NULL
ALTER TABLE "Institution" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "Period" DROP COLUMN "weightPercentage";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "CustomPerformanceLevel";

-- DropTable
DROP TABLE "EvaluationProcess";

-- DropTable
DROP TABLE "EvaluationSubprocess";

-- DropTable
DROP TABLE "GradingScaleConfig";

-- DropEnum
DROP TYPE "CalculationMethod";

-- DropEnum
DROP TYPE "CalendarType";

-- DropEnum
DROP TYPE "ProcessType";

-- CreateTable
CREATE TABLE "InstitutionModule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "module" "SystemModule" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "InstitutionModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionModule_institutionId_module_key" ON "InstitutionModule"("institutionId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionUser_userId_institutionId_key" ON "InstitutionUser"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionModule" ADD CONSTRAINT "InstitutionModule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
