-- CreateTable
CREATE TABLE "ReportCardConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showShield" BOOLEAN NOT NULL DEFAULT false,
    "headerResolution" TEXT,
    "headerMunicipality" TEXT,
    "headerDepartment" TEXT,
    "evaluationType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "showNumericGrade" BOOLEAN NOT NULL DEFAULT true,
    "showPerformanceLevel" BOOLEAN NOT NULL DEFAULT true,
    "showAchievements" BOOLEAN NOT NULL DEFAULT true,
    "showRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "showMotivationalMsg" BOOLEAN NOT NULL DEFAULT true,
    "motivationalMsgType" TEXT NOT NULL DEFAULT 'AUTO',
    "customMotivationalTpl" TEXT,
    "showAttendance" BOOLEAN NOT NULL DEFAULT true,
    "showRanking" BOOLEAN NOT NULL DEFAULT true,
    "showObservations" BOOLEAN NOT NULL DEFAULT true,
    "showAreaAverages" BOOLEAN NOT NULL DEFAULT true,
    "showGeneralAverage" BOOLEAN NOT NULL DEFAULT true,
    "showScale" BOOLEAN NOT NULL DEFAULT true,
    "showRecoveryGrades" BOOLEAN NOT NULL DEFAULT true,
    "showComponents" BOOLEAN NOT NULL DEFAULT false,
    "signatureConfig" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardConfig_institutionId_key" ON "ReportCardConfig"("institutionId");

-- CreateIndex
CREATE INDEX "ReportCardConfig_institutionId_idx" ON "ReportCardConfig"("institutionId");

-- AddForeignKey
ALTER TABLE "ReportCardConfig" ADD CONSTRAINT "ReportCardConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
