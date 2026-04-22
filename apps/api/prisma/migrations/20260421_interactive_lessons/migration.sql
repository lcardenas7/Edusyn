-- AlterEnum: Add LESSON to ClassroomActivityType
ALTER TYPE "ClassroomActivityType" ADD VALUE 'LESSON';

-- CreateEnum: LessonSlideType
CREATE TYPE "LessonSlideType" AS ENUM ('CONTENT', 'ACTIVITY', 'CHECKPOINT', 'BADGE_REVEAL');

-- CreateEnum: LessonProgressStatus
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable: Lesson
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "badgeEmoji" TEXT DEFAULT '🏆',
    "badgeTitle" TEXT DEFAULT 'Lección completada',
    "badgeColor" TEXT DEFAULT '#8B5CF6',
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LessonSlide
CREATE TABLE "LessonSlide" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "LessonSlideType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "body" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "layout" TEXT DEFAULT 'text-left-image-right',
    "activityData" JSONB,
    "badgeEmoji" TEXT,
    "badgeTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LessonProgress
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentSlideIndex" INTEGER NOT NULL DEFAULT 0,
    "completedSlides" JSONB,
    "answers" JSONB,
    "score" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "maxScore" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "badgeEarned" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckpointIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Lesson
CREATE UNIQUE INDEX "Lesson_activityId_key" ON "Lesson"("activityId");
CREATE INDEX "Lesson_activityId_idx" ON "Lesson"("activityId");

-- CreateIndex: LessonSlide
CREATE INDEX "LessonSlide_lessonId_idx" ON "LessonSlide"("lessonId");
CREATE INDEX "LessonSlide_lessonId_sortOrder_idx" ON "LessonSlide"("lessonId", "sortOrder");

-- CreateIndex: LessonProgress
CREATE UNIQUE INDEX "LessonProgress_lessonId_studentEnrollmentId_key" ON "LessonProgress"("lessonId", "studentEnrollmentId");
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");
CREATE INDEX "LessonProgress_studentEnrollmentId_idx" ON "LessonProgress"("studentEnrollmentId");

-- AddForeignKey: Lesson -> ClassroomActivity
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LessonSlide -> Lesson
ALTER TABLE "LessonSlide" ADD CONSTRAINT "LessonSlide_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LessonProgress -> Lesson
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LessonProgress -> StudentEnrollment
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
