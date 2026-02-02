-- DropForeignKey
ALTER TABLE "EnrollmentArea" DROP CONSTRAINT "EnrollmentArea_areaId_fkey";

-- DropForeignKey
ALTER TABLE "EnrollmentSubject" DROP CONSTRAINT "EnrollmentSubject_subjectId_fkey";

-- AlterTable
ALTER TABLE "EnrollmentArea" ALTER COLUMN "areaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EnrollmentSubject" ADD COLUMN     "teacherId" TEXT,
ADD COLUMN     "teacherName" TEXT,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "EnrollmentSubject_teacherId_idx" ON "EnrollmentSubject"("teacherId");

-- AddForeignKey
ALTER TABLE "EnrollmentArea" ADD CONSTRAINT "EnrollmentArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
