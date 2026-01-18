-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'COMMITMENT');

-- CreateEnum
CREATE TYPE "ObservationCategory" AS ENUM ('ACADEMIC', 'BEHAVIORAL', 'ATTENDANCE', 'UNIFORM', 'OTHER');

-- CreateTable
CREATE TABLE "StudentObservation" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ObservationType" NOT NULL,
    "category" "ObservationCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentNotifiedAt" TIMESTAMP(3),
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentObservation_studentEnrollmentId_idx" ON "StudentObservation"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentObservation_authorId_idx" ON "StudentObservation"("authorId");

-- CreateIndex
CREATE INDEX "StudentObservation_date_idx" ON "StudentObservation"("date");

-- CreateIndex
CREATE INDEX "StudentObservation_type_idx" ON "StudentObservation"("type");

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObservation" ADD CONSTRAINT "StudentObservation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
