/*
  Warnings:

  - The values [INACTIVE,GRADUATED] on the enum `EnrollmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[promotedFromId]` on the table `StudentEnrollment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('A', 'B', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('NEW', 'RENEWAL', 'TRANSFER_IN', 'REENTRY');

-- CreateEnum
CREATE TYPE "EnrollmentEventType" AS ENUM ('CREATED', 'GROUP_CHANGED', 'WITHDRAWN', 'TRANSFERRED', 'PROMOTED', 'REPEATED', 'REACTIVATED', 'STATUS_CHANGED', 'GRADE_CORRECTED', 'PROMOTION_EXCEPTION');

-- CreateEnum
CREATE TYPE "EnrollmentMovementType" AS ENUM ('ADMINISTRATIVE', 'ACADEMIC');

-- CreateEnum
CREATE TYPE "StudyModality" AS ENUM ('PRESENTIAL', 'VIRTUAL', 'HYBRID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AcademicActType" ADD VALUE 'GRADE_CORRECTION';
ALTER TYPE "AcademicActType" ADD VALUE 'PROMOTION_EXCEPTION';
ALTER TYPE "AcademicActType" ADD VALUE 'ATTENDANCE_CORRECTION';
ALTER TYPE "AcademicActType" ADD VALUE 'ENROLLMENT_CORRECTION';
ALTER TYPE "AcademicActType" ADD VALUE 'COMMITTEE_DECISION';
ALTER TYPE "AcademicActType" ADD VALUE 'YEAR_CLOSURE';

-- AlterEnum
BEGIN;
CREATE TYPE "EnrollmentStatus_new" AS ENUM ('ACTIVE', 'PROMOTED', 'REPEATED', 'WITHDRAWN', 'TRANSFERRED');
ALTER TABLE "StudentEnrollment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StudentEnrollment" ALTER COLUMN "status" TYPE "EnrollmentStatus_new" USING ("status"::text::"EnrollmentStatus_new");
ALTER TYPE "EnrollmentStatus" RENAME TO "EnrollmentStatus_old";
ALTER TYPE "EnrollmentStatus_new" RENAME TO "EnrollmentStatus";
DROP TYPE "EnrollmentStatus_old";
ALTER TABLE "StudentEnrollment" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedById" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "status" "AcademicYearStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "StudentEnrollment" ADD COLUMN     "enrolledById" TEXT,
ADD COLUMN     "enrollmentType" "EnrollmentType" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "modality" "StudyModality" NOT NULL DEFAULT 'PRESENTIAL',
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "promotedFromId" TEXT,
ADD COLUMN     "shift" "SchoolShift",
ADD COLUMN     "withdrawalDate" TIMESTAMP(3),
ADD COLUMN     "withdrawalReason" TEXT;

-- CreateTable
CREATE TABLE "AcademicCalendar" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" "CalendarType" NOT NULL DEFAULT 'A',
    "totalWeeks" INTEGER NOT NULL DEFAULT 40,
    "totalHours" INTEGER NOT NULL DEFAULT 800,
    "classStartDate" TIMESTAMP(3),
    "classEndDate" TIMESTAMP(3),
    "developmentWeeks" INTEGER NOT NULL DEFAULT 5,
    "vacations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentEvent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "EnrollmentEventType" NOT NULL,
    "movementType" "EnrollmentMovementType",
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "observations" TEXT,
    "academicActId" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCalendar_academicYearId_key" ON "AcademicCalendar"("academicYearId");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_enrollmentId_idx" ON "EnrollmentEvent"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_performedAt_idx" ON "EnrollmentEvent"("performedAt");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_type_idx" ON "EnrollmentEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_promotedFromId_key" ON "StudentEnrollment"("promotedFromId");

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendar" ADD CONSTRAINT "AcademicCalendar_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_promotedFromId_fkey" FOREIGN KEY ("promotedFromId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentEvent" ADD CONSTRAINT "EnrollmentEvent_academicActId_fkey" FOREIGN KEY ("academicActId") REFERENCES "AcademicAct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
