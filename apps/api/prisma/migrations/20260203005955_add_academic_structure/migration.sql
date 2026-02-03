-- CreateEnum
CREATE TYPE "AcademicStructureType" AS ENUM ('DIMENSIONS', 'SUBJECTS_ONLY', 'AREAS_SUBJECTS');

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "academicStructure" "AcademicStructureType" NOT NULL DEFAULT 'AREAS_SUBJECTS';

-- CreateTable
CREATE TABLE "Dimension" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDimension" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentDimension" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dimensionId" TEXT,
    "dimensionName" TEXT NOT NULL,
    "dimensionCode" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentDimension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateDimension_templateId_idx" ON "TemplateDimension"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDimension_templateId_dimensionId_key" ON "TemplateDimension"("templateId", "dimensionId");

-- CreateIndex
CREATE INDEX "EnrollmentDimension_enrollmentId_idx" ON "EnrollmentDimension"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentDimension_enrollmentId_dimensionId_key" ON "EnrollmentDimension"("enrollmentId", "dimensionId");

-- AddForeignKey
ALTER TABLE "TemplateDimension" ADD CONSTRAINT "TemplateDimension_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcademicTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDimension" ADD CONSTRAINT "TemplateDimension_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDimension" ADD CONSTRAINT "EnrollmentDimension_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDimension" ADD CONSTRAINT "EnrollmentDimension_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;
