-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CalculationMethod" AS ENUM ('SIMPLE_AVERAGE', 'WEIGHTED_AVERAGE', 'BEST_GRADE', 'LAST_GRADE');

-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "RecoveryType" AS ENUM ('PERIOD', 'FINAL');

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'NOT_APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecoveryImpactType" AS ENUM ('ADJUST_TO_MINIMUM', 'AVERAGE_WITH_ORIGINAL', 'REPLACE_IF_HIGHER', 'QUALITATIVE_ONLY');

-- CreateEnum
CREATE TYPE "AcademicActType" AS ENUM ('ACADEMIC_COUNCIL', 'PROMOTION', 'RECOVERY_APPROVAL', 'FINAL_DECISION');

-- CreateEnum
CREATE TYPE "PerformanceDimension" AS ENUM ('COGNITIVO', 'PROCEDIMENTAL', 'ACTITUDINAL');

-- CreateEnum
CREATE TYPE "ComplementDisplayMode" AS ENUM ('CONCATENATE', 'SEPARATE_LINE');

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "calendarType" "CalendarType" NOT NULL DEFAULT 'CUATRIMESTRAL',
ADD COLUMN     "numberOfPeriods" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "periodsWeight" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "semesterExamWeight" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "useSemesterExams" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Period" ADD COLUMN     "weightPercentage" INTEGER NOT NULL DEFAULT 25;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GradingPeriodConfig" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "allowLateEntry" BOOLEAN NOT NULL DEFAULT false,
    "lateEntryDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingPeriodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryPeriodConfig" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "allowLateEntry" BOOLEAN NOT NULL DEFAULT false,
    "lateEntryDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPeriodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodFinalGrade" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "finalScore" DECIMAL(3,1) NOT NULL,
    "observations" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodFinalGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartialGrade" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "activityIndex" INTEGER NOT NULL,
    "activityName" TEXT NOT NULL,
    "activityType" TEXT,
    "score" DECIMAL(3,1) NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartialGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "minPassingScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "periodRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "periodMaxScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "periodImpactType" "RecoveryImpactType" NOT NULL DEFAULT 'ADJUST_TO_MINIMUM',
    "finalRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "finalMaxScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "finalImpactType" "RecoveryImpactType" NOT NULL DEFAULT 'ADJUST_TO_MINIMUM',
    "maxAreasRecoverable" INTEGER NOT NULL DEFAULT 2,
    "periodRecoveryStartDate" TIMESTAMP(3),
    "periodRecoveryEndDate" TIMESTAMP(3),
    "finalRecoveryStartDate" TIMESTAMP(3),
    "finalRecoveryEndDate" TIMESTAMP(3),
    "requiresAcademicCouncilAct" BOOLEAN NOT NULL DEFAULT true,
    "requiresPromotionAct" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodRecovery" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "originalScore" DECIMAL(3,1) NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "activityDescription" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "reinforcedDimension" TEXT DEFAULT 'COGNITIVA',
    "recoveryScore" DECIMAL(3,1),
    "finalScore" DECIMAL(3,1),
    "impactType" "RecoveryImpactType",
    "evidences" TEXT,
    "observations" TEXT,
    "assignedById" TEXT NOT NULL,
    "evaluatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalRecoveryPlan" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "originalAreaScore" DECIMAL(3,1) NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "activities" TEXT,
    "objectives" TEXT,
    "resources" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "recoveryScore" DECIMAL(3,1),
    "finalAreaScore" DECIMAL(3,1),
    "impactType" "RecoveryImpactType",
    "evidences" TEXT,
    "observations" TEXT,
    "responsibleTeacherId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "finalDecision" TEXT,
    "approvedById" TEXT,
    "approvalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalRecoveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicAct" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "actType" "AcademicActType" NOT NULL,
    "actNumber" TEXT NOT NULL,
    "actDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "decisions" TEXT,
    "attendees" TEXT,
    "studentEnrollmentId" TEXT,
    "finalRecoveryPlanId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvalDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicAct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceLevelComplement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "complement" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayMode" "ComplementDisplayMode" NOT NULL DEFAULT 'CONCATENATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceLevelComplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showByDimension" BOOLEAN NOT NULL DEFAULT true,
    "allowManualEdit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectPerformance" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "dimension" "PerformanceDimension" NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceManualEdit" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "dimension" "PerformanceDimension" NOT NULL,
    "originalText" TEXT NOT NULL,
    "editedText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceManualEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingScaleConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "minScore" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    "maxScore" DECIMAL(3,1) NOT NULL DEFAULT 5.0,
    "passingScore" DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    "decimalsAllowed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingScaleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPerformanceLevel" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "minScore" DECIMAL(3,1) NOT NULL,
    "maxScore" DECIMAL(3,1) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPerformanceLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationProcess" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "weightPercentage" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "processType" "ProcessType" NOT NULL DEFAULT 'AUTOMATIC',
    "allowsSubprocesses" BOOLEAN NOT NULL DEFAULT true,
    "visibleInReport" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationSubprocess" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "weightPercentage" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "numberOfInstruments" INTEGER NOT NULL DEFAULT 3,
    "calculationMethod" "CalculationMethod" NOT NULL DEFAULT 'SIMPLE_AVERAGE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationSubprocess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradingPeriodConfig_academicTermId_key" ON "GradingPeriodConfig"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPeriodConfig_academicTermId_key" ON "RecoveryPeriodConfig"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodFinalGrade_studentEnrollmentId_academicTermId_subject_key" ON "PeriodFinalGrade"("studentEnrollmentId", "academicTermId", "subjectId");

-- CreateIndex
CREATE INDEX "PartialGrade_teacherAssignmentId_academicTermId_idx" ON "PartialGrade"("teacherAssignmentId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PartialGrade_studentEnrollmentId_teacherAssignmentId_academ_key" ON "PartialGrade"("studentEnrollmentId", "teacherAssignmentId", "academicTermId", "componentType", "activityIndex");

-- CreateIndex
CREATE INDEX "Announcement_institutionId_idx" ON "Announcement"("institutionId");

-- CreateIndex
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");

-- CreateIndex
CREATE INDEX "GalleryImage_institutionId_idx" ON "GalleryImage"("institutionId");

-- CreateIndex
CREATE INDEX "GalleryImage_isActive_idx" ON "GalleryImage"("isActive");

-- CreateIndex
CREATE INDEX "GalleryImage_category_idx" ON "GalleryImage"("category");

-- CreateIndex
CREATE INDEX "Event_institutionId_idx" ON "Event"("institutionId");

-- CreateIndex
CREATE INDEX "Event_eventDate_idx" ON "Event"("eventDate");

-- CreateIndex
CREATE INDEX "Event_isActive_idx" ON "Event"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryConfig_institutionId_academicYearId_key" ON "RecoveryConfig"("institutionId", "academicYearId");

-- CreateIndex
CREATE INDEX "PeriodRecovery_studentEnrollmentId_idx" ON "PeriodRecovery"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PeriodRecovery_academicTermId_idx" ON "PeriodRecovery"("academicTermId");

-- CreateIndex
CREATE INDEX "PeriodRecovery_status_idx" ON "PeriodRecovery"("status");

-- CreateIndex
CREATE INDEX "FinalRecoveryPlan_studentEnrollmentId_idx" ON "FinalRecoveryPlan"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "FinalRecoveryPlan_academicYearId_idx" ON "FinalRecoveryPlan"("academicYearId");

-- CreateIndex
CREATE INDEX "FinalRecoveryPlan_status_idx" ON "FinalRecoveryPlan"("status");

-- CreateIndex
CREATE INDEX "AcademicAct_institutionId_idx" ON "AcademicAct"("institutionId");

-- CreateIndex
CREATE INDEX "AcademicAct_academicYearId_idx" ON "AcademicAct"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicAct_actType_idx" ON "AcademicAct"("actType");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceLevelComplement_institutionId_level_key" ON "PerformanceLevelComplement"("institutionId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceConfig_institutionId_key" ON "PerformanceConfig"("institutionId");

-- CreateIndex
CREATE INDEX "SubjectPerformance_teacherAssignmentId_idx" ON "SubjectPerformance"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "SubjectPerformance_academicTermId_idx" ON "SubjectPerformance"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectPerformance_teacherAssignmentId_academicTermId_dimen_key" ON "SubjectPerformance"("teacherAssignmentId", "academicTermId", "dimension");

-- CreateIndex
CREATE INDEX "PerformanceManualEdit_studentEnrollmentId_idx" ON "PerformanceManualEdit"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PerformanceManualEdit_academicTermId_idx" ON "PerformanceManualEdit"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScaleConfig_institutionId_key" ON "GradingScaleConfig"("institutionId");

-- CreateIndex
CREATE INDEX "CustomPerformanceLevel_institutionId_idx" ON "CustomPerformanceLevel"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPerformanceLevel_institutionId_code_key" ON "CustomPerformanceLevel"("institutionId", "code");

-- CreateIndex
CREATE INDEX "EvaluationProcess_institutionId_idx" ON "EvaluationProcess"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationProcess_institutionId_code_key" ON "EvaluationProcess"("institutionId", "code");

-- CreateIndex
CREATE INDEX "EvaluationSubprocess_processId_idx" ON "EvaluationSubprocess"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationSubprocess_processId_code_key" ON "EvaluationSubprocess"("processId", "code");

-- AddForeignKey
ALTER TABLE "GradingPeriodConfig" ADD CONSTRAINT "GradingPeriodConfig_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPeriodConfig" ADD CONSTRAINT "RecoveryPeriodConfig_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodFinalGrade" ADD CONSTRAINT "PeriodFinalGrade_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialGrade" ADD CONSTRAINT "PartialGrade_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryConfig" ADD CONSTRAINT "RecoveryConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryConfig" ADD CONSTRAINT "RecoveryConfig_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRecovery" ADD CONSTRAINT "PeriodRecovery_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_responsibleTeacherId_fkey" FOREIGN KEY ("responsibleTeacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRecoveryPlan" ADD CONSTRAINT "FinalRecoveryPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_finalRecoveryPlanId_fkey" FOREIGN KEY ("finalRecoveryPlanId") REFERENCES "FinalRecoveryPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAct" ADD CONSTRAINT "AcademicAct_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLevelComplement" ADD CONSTRAINT "PerformanceLevelComplement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceConfig" ADD CONSTRAINT "PerformanceConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectPerformance" ADD CONSTRAINT "SubjectPerformance_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectPerformance" ADD CONSTRAINT "SubjectPerformance_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceManualEdit" ADD CONSTRAINT "PerformanceManualEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingScaleConfig" ADD CONSTRAINT "GradingScaleConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPerformanceLevel" ADD CONSTRAINT "CustomPerformanceLevel_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationProcess" ADD CONSTRAINT "EvaluationProcess_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationSubprocess" ADD CONSTRAINT "EvaluationSubprocess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "EvaluationProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
