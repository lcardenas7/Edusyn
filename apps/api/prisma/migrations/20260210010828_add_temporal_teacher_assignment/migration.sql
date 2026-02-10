/*
  Warnings:

  - A unique constraint covering the columns `[academicYearId,groupId,subjectId,teacherId,startDate]` on the table `TeacherAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TeacherAssignment_academicYearId_groupId_subjectId_teacherI_key";

-- AlterTable
ALTER TABLE "TeacherAssignment" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_academicYearId_groupId_subjectId_teacherI_key" ON "TeacherAssignment"("academicYearId", "groupId", "subjectId", "teacherId", "startDate");
