-- El Taller — Núcleo (Objetos Universales + Grafo + Eventos). Tablas NUEVAS y aditivas.
-- No toca ninguna tabla existente (el ABP legacy sigue intacto).

-- CreateEnum
CREATE TYPE "TallerObjectType" AS ENUM ('PostIt', 'Idea', 'Vote', 'Comment', 'Task', 'Evidence', 'Decision', 'Note', 'Question', 'Link', 'Attachment');

-- CreateTable
CREATE TABLE "TallerInstrument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT,
    "expeditionId" TEXT,
    "teamId" TEXT,
    "stationId" TEXT,
    "motor" TEXT NOT NULL,
    "dynamic" TEXT,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallerInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallerObject" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT,
    "expeditionId" TEXT,
    "teamId" TEXT,
    "stationId" TEXT,
    "instrumentId" TEXT,
    "type" "TallerObjectType" NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "state" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallerObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallerRelation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT,
    "relType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TallerRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallerEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "courseId" TEXT,
    "expeditionId" TEXT,
    "teamId" TEXT,
    "stationId" TEXT,
    "instrumentId" TEXT,
    "objectType" TEXT,
    "objectId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "causationId" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "TallerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TallerInstrument_institutionId_idx" ON "TallerInstrument"("institutionId");
CREATE INDEX "TallerInstrument_teamId_idx" ON "TallerInstrument"("teamId");
CREATE INDEX "TallerInstrument_expeditionId_idx" ON "TallerInstrument"("expeditionId");
CREATE INDEX "TallerObject_institutionId_idx" ON "TallerObject"("institutionId");
CREATE INDEX "TallerObject_instrumentId_idx" ON "TallerObject"("instrumentId");
CREATE INDEX "TallerObject_teamId_idx" ON "TallerObject"("teamId");
CREATE INDEX "TallerObject_expeditionId_idx" ON "TallerObject"("expeditionId");
CREATE INDEX "TallerObject_type_idx" ON "TallerObject"("type");
CREATE INDEX "TallerRelation_institutionId_idx" ON "TallerRelation"("institutionId");
CREATE INDEX "TallerRelation_fromId_idx" ON "TallerRelation"("fromId");
CREATE INDEX "TallerRelation_toId_idx" ON "TallerRelation"("toId");
CREATE INDEX "TallerRelation_teamId_idx" ON "TallerRelation"("teamId");
CREATE UNIQUE INDEX "TallerRelation_fromId_toId_relType_key" ON "TallerRelation"("fromId", "toId", "relType");
CREATE INDEX "TallerEvent_institutionId_idx" ON "TallerEvent"("institutionId");
CREATE INDEX "TallerEvent_teamId_idx" ON "TallerEvent"("teamId");
CREATE INDEX "TallerEvent_expeditionId_idx" ON "TallerEvent"("expeditionId");
CREATE INDEX "TallerEvent_instrumentId_idx" ON "TallerEvent"("instrumentId");
CREATE INDEX "TallerEvent_type_idx" ON "TallerEvent"("type");
CREATE INDEX "TallerEvent_occurredAt_idx" ON "TallerEvent"("occurredAt");

-- AddForeignKey
ALTER TABLE "TallerObject" ADD CONSTRAINT "TallerObject_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "TallerInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
