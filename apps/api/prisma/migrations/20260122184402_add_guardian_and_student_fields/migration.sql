-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'STEPFATHER', 'STEPMOTHER', 'GRANDFATHER', 'GRANDMOTHER', 'UNCLE', 'AUNT', 'SIBLING', 'LEGAL_GUARDIAN', 'OTHER');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "birthPlace" TEXT,
ADD COLUMN     "bloodType" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "disability" TEXT,
ADD COLUMN     "disabilityType" TEXT,
ADD COLUMN     "displacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "eps" TEXT,
ADD COLUMN     "ethnicity" TEXT,
ADD COLUMN     "medicalConditions" TEXT,
ADD COLUMN     "medications" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "photo" TEXT,
ADD COLUMN     "previousSchool" TEXT,
ADD COLUMN     "secondLastName" TEXT,
ADD COLUMN     "secondName" TEXT,
ADD COLUMN     "sisbenLevel" TEXT,
ADD COLUMN     "stratum" INTEGER;

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "secondName" TEXT,
    "lastName" TEXT NOT NULL,
    "secondLastName" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "occupation" TEXT,
    "workplace" TEXT,
    "workPhone" TEXT,
    "workAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canPickUp" BOOLEAN NOT NULL DEFAULT true,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "receivesNotifications" BOOLEAN NOT NULL DEFAULT true,
    "receivesGrades" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_institutionId_documentNumber_key" ON "Guardian"("institutionId", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
