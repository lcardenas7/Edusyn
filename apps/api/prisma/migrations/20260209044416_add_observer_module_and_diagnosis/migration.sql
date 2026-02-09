/*
  Warnings:

  - The values [NEGATIVE,NEUTRAL] on the enum `ObservationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ObserverEntryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- AlterEnum
BEGIN;
CREATE TYPE "ObservationType_new" AS ENUM ('POSITIVE', 'PEDAGOGICAL', 'BEHAVIORAL_MILD', 'ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III', 'PARENT_CITATION', 'COMMITMENT', 'COUNSELING_FOLLOWUP', 'REFERRAL', 'COMMITTEE_DECISION', 'PEDAGOGICAL_FOLLOWUP');
ALTER TABLE "StudentObservation" ALTER COLUMN "type" TYPE "ObservationType_new" USING ("type"::text::"ObservationType_new");
ALTER TYPE "ObservationType" RENAME TO "ObservationType_old";
ALTER TYPE "ObservationType_new" RENAME TO "ObservationType";
DROP TYPE "ObservationType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "diagnosisDate" TIMESTAMP(3),
ADD COLUMN     "diagnosisDetails" TEXT,
ADD COLUMN     "diagnosisEntity" TEXT,
ADD COLUMN     "diagnosisSupports" TEXT,
ADD COLUMN     "diagnosisType" TEXT,
ADD COLUMN     "hasDiagnosis" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentObservation" ADD COLUMN     "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "ActaRecord" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "actaNumber" TEXT,
    "actaType" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "regulationApplied" TEXT,
    "witnesses" TEXT,
    "studentStatement" TEXT,
    "digitalSignatures" TEXT,
    "sanctions" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObserverCommitment" (
    "id" TEXT NOT NULL,
    "observationId" TEXT,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "responsibleRole" TEXT,
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closureEvidence" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObserverCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianCitation" (
    "id" TEXT NOT NULL,
    "observationId" TEXT,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "attended" BOOLEAN,
    "agreements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObserverReferral" (
    "id" TEXT NOT NULL,
    "observationId" TEXT,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "referredToRole" TEXT NOT NULL,
    "referredToUserId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "responseNotes" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObserverReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObserverEvidence" (
    "id" TEXT NOT NULL,
    "observationId" TEXT,
    "actaRecordId" TEXT,
    "citationId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObserverEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogicalMeasure" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "measureType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ObserverEntryStatus" NOT NULL DEFAULT 'OPEN',
    "result" TEXT,
    "appliedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedagogicalMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActaRecord_observationId_key" ON "ActaRecord"("observationId");

-- CreateIndex
CREATE INDEX "ActaRecord_actaType_idx" ON "ActaRecord"("actaType");

-- CreateIndex
CREATE INDEX "ObserverCommitment_studentEnrollmentId_idx" ON "ObserverCommitment"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "ObserverCommitment_status_idx" ON "ObserverCommitment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianCitation_observationId_key" ON "GuardianCitation"("observationId");

-- CreateIndex
CREATE INDEX "GuardianCitation_studentEnrollmentId_idx" ON "GuardianCitation"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "GuardianCitation_scheduledDate_idx" ON "GuardianCitation"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ObserverReferral_observationId_key" ON "ObserverReferral"("observationId");

-- CreateIndex
CREATE INDEX "ObserverReferral_studentEnrollmentId_idx" ON "ObserverReferral"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "ObserverReferral_status_idx" ON "ObserverReferral"("status");

-- CreateIndex
CREATE INDEX "ObserverEvidence_observationId_idx" ON "ObserverEvidence"("observationId");

-- CreateIndex
CREATE INDEX "PedagogicalMeasure_studentEnrollmentId_idx" ON "PedagogicalMeasure"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PedagogicalMeasure_status_idx" ON "PedagogicalMeasure"("status");

-- CreateIndex
CREATE INDEX "StudentObservation_status_idx" ON "StudentObservation"("status");

-- AddForeignKey
ALTER TABLE "ActaRecord" ADD CONSTRAINT "ActaRecord_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverCommitment" ADD CONSTRAINT "ObserverCommitment_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianCitation" ADD CONSTRAINT "GuardianCitation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_referredToUserId_fkey" FOREIGN KEY ("referredToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverReferral" ADD CONSTRAINT "ObserverReferral_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_actaRecordId_fkey" FOREIGN KEY ("actaRecordId") REFERENCES "ActaRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "GuardianCitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObserverEvidence" ADD CONSTRAINT "ObserverEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMeasure" ADD CONSTRAINT "PedagogicalMeasure_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
