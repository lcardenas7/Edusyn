-- CreateTable: TutoringAttendance (asistencia de tutoría / dirección de grupo)
CREATE TABLE "TutoringAttendance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutoringAttendance_institutionId_idx" ON "TutoringAttendance"("institutionId");
CREATE INDEX "TutoringAttendance_groupId_date_idx" ON "TutoringAttendance"("groupId", "date");
CREATE INDEX "TutoringAttendance_teacherId_idx" ON "TutoringAttendance"("teacherId");
CREATE INDEX "TutoringAttendance_studentEnrollmentId_date_idx" ON "TutoringAttendance"("studentEnrollmentId", "date");

-- CreateUniqueIndex (un estudiante solo puede tener un registro de tutoría por grupo por día)
CREATE UNIQUE INDEX "TutoringAttendance_groupId_studentEnrollmentId_date_key" ON "TutoringAttendance"("groupId", "studentEnrollmentId", "date");

-- AddForeignKey
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutoringAttendance" ADD CONSTRAINT "TutoringAttendance_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
