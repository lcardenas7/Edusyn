-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('FIXED_TEACHER', 'ROTATING_TEACHER');

-- CreateEnum
CREATE TYPE "TimeBlockType" AS ENUM ('CLASS', 'BREAK', 'LUNCH', 'ASSEMBLY', 'FREE');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "RoomRestrictionType" AS ENUM ('PREFERRED', 'EXCLUSIVE');

-- AlterEnum
ALTER TYPE "SystemModule" ADD VALUE 'TIMETABLE';

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "TimeBlockType" NOT NULL DEFAULT 'CLASS',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "capacity" INTEGER,
    "description" TEXT,
    "equipment" TEXT[],
    "isReservable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRestriction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "subjectId" TEXT,
    "type" "RoomRestrictionType" NOT NULL DEFAULT 'PREFERRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleGradeConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "mode" "ScheduleMode" NOT NULL DEFAULT 'ROTATING_TEACHER',
    "maxConsecutiveHours" INTEGER,
    "preferDistribution" BOOLEAN NOT NULL DEFAULT true,
    "avoidHeavyLastHours" BOOLEAN NOT NULL DEFAULT false,
    "allowDoubleBlocks" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleGradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "timeBlockId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "teacherAssignmentId" TEXT,
    "projectName" TEXT,
    "projectDescription" TEXT,
    "roomId" TEXT,
    "notes" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeBlock_institutionId_idx" ON "TimeBlock"("institutionId");

-- CreateIndex
CREATE INDEX "TimeBlock_shiftId_idx" ON "TimeBlock"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBlock_institutionId_shiftId_order_key" ON "TimeBlock"("institutionId", "shiftId", "order");

-- CreateIndex
CREATE INDEX "Room_institutionId_idx" ON "Room"("institutionId");

-- CreateIndex
CREATE INDEX "Room_campusId_idx" ON "Room"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_institutionId_name_key" ON "Room"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RoomRestriction_roomId_subjectId_key" ON "RoomRestriction"("roomId", "subjectId");

-- CreateIndex
CREATE INDEX "ScheduleGradeConfig_institutionId_idx" ON "ScheduleGradeConfig"("institutionId");

-- CreateIndex
CREATE INDEX "ScheduleGradeConfig_academicYearId_idx" ON "ScheduleGradeConfig"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleGradeConfig_institutionId_academicYearId_gradeId_key" ON "ScheduleGradeConfig"("institutionId", "academicYearId", "gradeId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_institutionId_idx" ON "TeacherAvailability"("institutionId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_teacherId_idx" ON "TeacherAvailability"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_academicYearId_idx" ON "TeacherAvailability"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_institutionId_academicYearId_teacherId__key" ON "TeacherAvailability"("institutionId", "academicYearId", "teacherId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "ScheduleEntry_institutionId_idx" ON "ScheduleEntry"("institutionId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_academicYearId_idx" ON "ScheduleEntry"("academicYearId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_groupId_idx" ON "ScheduleEntry"("groupId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_timeBlockId_idx" ON "ScheduleEntry"("timeBlockId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_teacherAssignmentId_idx" ON "ScheduleEntry"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_roomId_idx" ON "ScheduleEntry"("roomId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_dayOfWeek_idx" ON "ScheduleEntry"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_groupId_timeBlockId_dayOfWeek_key" ON "ScheduleEntry"("groupId", "timeBlockId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRestriction" ADD CONSTRAINT "RoomRestriction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRestriction" ADD CONSTRAINT "RoomRestriction_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGradeConfig" ADD CONSTRAINT "ScheduleGradeConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGradeConfig" ADD CONSTRAINT "ScheduleGradeConfig_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleGradeConfig" ADD CONSTRAINT "ScheduleGradeConfig_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_timeBlockId_fkey" FOREIGN KEY ("timeBlockId") REFERENCES "TimeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
