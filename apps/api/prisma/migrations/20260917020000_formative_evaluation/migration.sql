-- Evaluación formativa (rúbricas, autoevaluación y coevaluación): dominio propio, separado de la planilla.
-- Aditiva: solo crea tipos, tablas, índices y llaves nuevas. No modifica registros existentes ni PartialGrade.
-- Reglas de borrado: siguen al aula, la asignación, el período y la matrícula (cascada), para no bloquear
-- los flujos existentes de borrado; el autor y quien sincroniza quedan restringidos como en Edusyn Crea.

-- CreateEnum
CREATE TYPE "FormativeEvaluationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'CLOSED', 'CONSOLIDATED', 'SYNCED', 'CHANGED_AFTER_SYNC');

-- CreateEnum
CREATE TYPE "FormativeEvaluatorType" AS ENUM ('SELF', 'PEER', 'TEACHER');

-- CreateEnum
CREATE TYPE "FormativeCommentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FormativeSyncStatus" AS ENUM ('PREVIEWED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED');

-- CreateTable
CREATE TABLE "FormativeEvaluationActivity" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormativeEvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "consolidatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "algorithmVersion" TEXT,
    "assignmentSeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormativeEvaluationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormativeEvaluationDimension" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "evaluatorType" "FormativeEvaluatorType" NOT NULL,
    "rubricId" TEXT,
    "rubricSnapshot" JSONB NOT NULL,
    "evaluationComponentId" TEXT,
    "gradebookActivityIndex" INTEGER,
    "peersPerStudent" INTEGER,
    "revealEvaluator" BOOLEAN NOT NULL DEFAULT false,
    "requireCommentReview" BOOLEAN NOT NULL DEFAULT true,
    "allowIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormativeEvaluationDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormativeEvaluationAssignment" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "evaluatorEnrollmentId" TEXT,
    "targetEnrollmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "answers" JSONB,
    "calculatedScore" DECIMAL(5,2),
    "qualitativeComments" JSONB,
    "commentStatus" "FormativeCommentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "exceptionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormativeEvaluationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormativeEvaluationResult" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "consolidationVersion" INTEGER NOT NULL DEFAULT 1,
    "quantitativeScore" DECIMAL(5,2),
    "qualitativeSummary" JSONB,
    "expectedResponses" INTEGER NOT NULL DEFAULT 0,
    "receivedResponses" INTEGER NOT NULL DEFAULT 0,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "consolidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormativeEvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormativeGradeSync" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "FormativeSyncStatus" NOT NULL DEFAULT 'PREVIEWED',
    "previewHash" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormativeGradeSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormativeGradeSyncItem" (
    "id" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "destinationComponentId" TEXT NOT NULL,
    "activityIndex" INTEGER NOT NULL,
    "scoreSent" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorDetail" TEXT,
    "partialGradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormativeGradeSyncItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormativeEvaluationActivity_institutionId_academicTermId_idx" ON "FormativeEvaluationActivity"("institutionId", "academicTermId");

-- CreateIndex
CREATE INDEX "FormativeEvaluationActivity_classroomId_status_idx" ON "FormativeEvaluationActivity"("classroomId", "status");

-- CreateIndex
CREATE INDEX "FormativeEvaluationDimension_activityId_order_idx" ON "FormativeEvaluationDimension"("activityId", "order");

-- CreateIndex
CREATE INDEX "FormativeEvaluationDimension_evaluationComponentId_idx" ON "FormativeEvaluationDimension"("evaluationComponentId");

-- CreateIndex
CREATE INDEX "FormativeEvaluationAssignment_activityId_evaluatorEnrollmen_idx" ON "FormativeEvaluationAssignment"("activityId", "evaluatorEnrollmentId", "status");

-- CreateIndex
CREATE INDEX "FormativeEvaluationAssignment_activityId_targetEnrollmentId_idx" ON "FormativeEvaluationAssignment"("activityId", "targetEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FormativeEvaluationAssignment_dimensionId_evaluatorEnrollme_key" ON "FormativeEvaluationAssignment"("dimensionId", "evaluatorEnrollmentId", "targetEnrollmentId");

-- CreateIndex
CREATE INDEX "FormativeEvaluationResult_activityId_studentEnrollmentId_idx" ON "FormativeEvaluationResult"("activityId", "studentEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FormativeEvaluationResult_dimensionId_studentEnrollmentId_c_key" ON "FormativeEvaluationResult"("dimensionId", "studentEnrollmentId", "consolidationVersion");

-- CreateIndex
CREATE INDEX "FormativeGradeSync_activityId_status_idx" ON "FormativeGradeSync"("activityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FormativeGradeSync_institutionId_idempotencyKey_key" ON "FormativeGradeSync"("institutionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FormativeGradeSyncItem_resultId_idx" ON "FormativeGradeSyncItem"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "FormativeGradeSyncItem_syncId_resultId_key" ON "FormativeGradeSyncItem"("syncId", "resultId");

-- AddForeignKey
ALTER TABLE "FormativeEvaluationActivity" ADD CONSTRAINT "FormativeEvaluationActivity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationActivity" ADD CONSTRAINT "FormativeEvaluationActivity_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationActivity" ADD CONSTRAINT "FormativeEvaluationActivity_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationActivity" ADD CONSTRAINT "FormativeEvaluationActivity_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationActivity" ADD CONSTRAINT "FormativeEvaluationActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationActivity" ADD CONSTRAINT "FormativeEvaluationActivity_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationDimension" ADD CONSTRAINT "FormativeEvaluationDimension_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "FormativeEvaluationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationDimension" ADD CONSTRAINT "FormativeEvaluationDimension_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "AttitudinalRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationDimension" ADD CONSTRAINT "FormativeEvaluationDimension_evaluationComponentId_fkey" FOREIGN KEY ("evaluationComponentId") REFERENCES "EvaluationComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationAssignment" ADD CONSTRAINT "FormativeEvaluationAssignment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "FormativeEvaluationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationAssignment" ADD CONSTRAINT "FormativeEvaluationAssignment_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "FormativeEvaluationDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationAssignment" ADD CONSTRAINT "FormativeEvaluationAssignment_evaluatorEnrollmentId_fkey" FOREIGN KEY ("evaluatorEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationAssignment" ADD CONSTRAINT "FormativeEvaluationAssignment_targetEnrollmentId_fkey" FOREIGN KEY ("targetEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationResult" ADD CONSTRAINT "FormativeEvaluationResult_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "FormativeEvaluationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationResult" ADD CONSTRAINT "FormativeEvaluationResult_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "FormativeEvaluationDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeEvaluationResult" ADD CONSTRAINT "FormativeEvaluationResult_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeGradeSync" ADD CONSTRAINT "FormativeGradeSync_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "FormativeEvaluationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeGradeSync" ADD CONSTRAINT "FormativeGradeSync_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeGradeSync" ADD CONSTRAINT "FormativeGradeSync_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeGradeSyncItem" ADD CONSTRAINT "FormativeGradeSyncItem_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "FormativeGradeSync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeGradeSyncItem" ADD CONSTRAINT "FormativeGradeSyncItem_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "FormativeEvaluationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormativeGradeSyncItem" ADD CONSTRAINT "FormativeGradeSyncItem_destinationComponentId_fkey" FOREIGN KEY ("destinationComponentId") REFERENCES "EvaluationComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

