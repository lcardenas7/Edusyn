-- CreateEnum
CREATE TYPE "EnrollmentDocType" AS ENUM ('REGISTRO_CIVIL', 'TARJETA_IDENTIDAD', 'CEDULA', 'FOTO', 'BOLETIN_ANTERIOR', 'CERTIFICADO_ESTUDIO', 'CERTIFICADO_CONDUCTA', 'EPS', 'SISBEN', 'CARNET_VACUNACION', 'PAZ_Y_SALVO', 'OTRO');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'DELIVERED', 'VALIDATED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "EnrollmentDocType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "observations" TEXT,
    "expirationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_idx" ON "StudentDocument"("studentId");

-- CreateIndex
CREATE INDEX "StudentDocument_type_idx" ON "StudentDocument"("type");

-- CreateIndex
CREATE INDEX "StudentDocument_status_idx" ON "StudentDocument"("status");

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
