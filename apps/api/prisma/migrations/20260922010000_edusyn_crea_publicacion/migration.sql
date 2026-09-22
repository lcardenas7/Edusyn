-- CreateEnum
CREATE TYPE "ConstruyePublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED');

-- AlterEnum
ALTER TYPE "ConstruyeJournalType" ADD VALUE 'PUBLICATION';

-- CreateTable
CREATE TABLE "ConstruyePublication" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ConstruyePublicationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "kind" "ConstruyeProjectKind" NOT NULL DEFAULT 'WEB',
    "manifest" JSONB,
    "versionNumber" INTEGER,
    "pendingVersionId" TEXT,
    "pendingVersionNumber" INTEGER,
    "pendingManifest" JSONB,
    "requestedAt" TIMESTAMP(3),
    "requestedByEnrollmentId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstruyePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstruyeAppDevice" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "source" TEXT,
    "isTeam" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedAt" TIMESTAMP(3),

    CONSTRAINT "ConstruyeAppDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstruyeAppDay" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "standalone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConstruyeAppDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConstruyePublication_teamId_key" ON "ConstruyePublication"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstruyePublication_token_key" ON "ConstruyePublication"("token");

-- CreateIndex
CREATE INDEX "ConstruyePublication_institutionId_idx" ON "ConstruyePublication"("institutionId");

-- CreateIndex
CREATE INDEX "ConstruyePublication_projectId_idx" ON "ConstruyePublication"("projectId");

-- CreateIndex
CREATE INDEX "ConstruyeAppDevice_publicationId_firstSeenAt_idx" ON "ConstruyeAppDevice"("publicationId", "firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConstruyeAppDevice_publicationId_deviceId_key" ON "ConstruyeAppDevice"("publicationId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstruyeAppDay_deviceId_day_key" ON "ConstruyeAppDay"("deviceId", "day");

-- AddForeignKey
ALTER TABLE "ConstruyePublication" ADD CONSTRAINT "ConstruyePublication_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ConstruyeTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstruyeAppDevice" ADD CONSTRAINT "ConstruyeAppDevice_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "ConstruyePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstruyeAppDay" ADD CONSTRAINT "ConstruyeAppDay_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ConstruyeAppDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

