-- CreateTable
CREATE TABLE "TeacherScheduleBlock" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherScheduleBlock_institutionId_idx" ON "TeacherScheduleBlock"("institutionId");

-- CreateIndex
CREATE INDEX "TeacherScheduleBlock_teacherId_idx" ON "TeacherScheduleBlock"("teacherId");

-- AddForeignKey
ALTER TABLE "TeacherScheduleBlock" ADD CONSTRAINT "TeacherScheduleBlock_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherScheduleBlock" ADD CONSTRAINT "TeacherScheduleBlock_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
