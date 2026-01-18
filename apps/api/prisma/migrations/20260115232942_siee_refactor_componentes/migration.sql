-- CreateEnum
CREATE TYPE "PerformanceLevel" AS ENUM ('SUPERIOR', 'ALTO', 'BASICO', 'BAJO');

-- CreateEnum
CREATE TYPE "AcademicTermType" AS ENUM ('PERIOD', 'SEMESTER_EXAM');

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" "AcademicTermType" NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "weightPercentage" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceScale" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "minScore" DECIMAL(65,30) NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluativeActivity" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "evaluationPlanId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluativeActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPlan" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationComponent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPlanComponentWeight" (
    "id" TEXT NOT NULL,
    "evaluationPlanId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationPlanComponentWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_academicYearId_order_key" ON "AcademicTerm"("academicYearId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceScale_institutionId_level_key" ON "PerformanceScale"("institutionId", "level");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_teacherAssignmentId_idx" ON "EvaluativeActivity"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_academicTermId_idx" ON "EvaluativeActivity"("academicTermId");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_evaluationPlanId_idx" ON "EvaluativeActivity"("evaluationPlanId");

-- CreateIndex
CREATE INDEX "EvaluativeActivity_componentId_idx" ON "EvaluativeActivity"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPlan_teacherAssignmentId_academicTermId_key" ON "EvaluationPlan"("teacherAssignmentId", "academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationComponent_institutionId_code_key" ON "EvaluationComponent"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPlanComponentWeight_evaluationPlanId_componentId_key" ON "EvaluationPlanComponentWeight"("evaluationPlanId", "componentId");

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceScale" ADD CONSTRAINT "PerformanceScale_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_evaluationPlanId_fkey" FOREIGN KEY ("evaluationPlanId") REFERENCES "EvaluationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluativeActivity" ADD CONSTRAINT "EvaluativeActivity_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "EvaluationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlan" ADD CONSTRAINT "EvaluationPlan_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlan" ADD CONSTRAINT "EvaluationPlan_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationComponent" ADD CONSTRAINT "EvaluationComponent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationComponent" ADD CONSTRAINT "EvaluationComponent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EvaluationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlanComponentWeight" ADD CONSTRAINT "EvaluationPlanComponentWeight_evaluationPlanId_fkey" FOREIGN KEY ("evaluationPlanId") REFERENCES "EvaluationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPlanComponentWeight" ADD CONSTRAINT "EvaluationPlanComponentWeight_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "EvaluationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
