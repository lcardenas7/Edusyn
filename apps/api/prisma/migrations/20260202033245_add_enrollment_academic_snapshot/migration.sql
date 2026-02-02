-- CreateTable
CREATE TABLE "EnrollmentArea" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "areaCode" TEXT,
    "weightPercentage" DOUBLE PRECISION NOT NULL,
    "calculationType" "AreaCalculationType" NOT NULL,
    "approvalRule" "AreaApprovalRule" NOT NULL,
    "recoveryRule" "AreaRecoveryRule" NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentSubject" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "enrollmentAreaId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "weightPercentage" DOUBLE PRECISION NOT NULL,
    "isDominant" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "achievementsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "useAttitudinalAchievement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentArea_enrollmentId_idx" ON "EnrollmentArea"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentArea_areaId_idx" ON "EnrollmentArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentArea_enrollmentId_areaId_key" ON "EnrollmentArea"("enrollmentId", "areaId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_enrollmentId_idx" ON "EnrollmentSubject"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_enrollmentAreaId_idx" ON "EnrollmentSubject"("enrollmentAreaId");

-- CreateIndex
CREATE INDEX "EnrollmentSubject_subjectId_idx" ON "EnrollmentSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentSubject_enrollmentId_subjectId_key" ON "EnrollmentSubject"("enrollmentId", "subjectId");

-- AddForeignKey
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_enrollmentAreaId_fkey" FOREIGN KEY ("enrollmentAreaId") REFERENCES "EnrollmentArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
