-- DISEÑO PEDAGÓGICO IA · E0 — cimientos (aditivo)
CREATE TYPE "PedagogicalExperienceType" AS ENUM ('LESSON_PLAN', 'SEQUENCE', 'PBL', 'STEAM', 'FLIPPED', 'CHALLENGE', 'WORKSHOP', 'LAB', 'EVALUATION', 'INTERACTIVE_LESSON', 'UNIT');
CREATE TYPE "PedagogicalDesignStatus" AS ENUM ('DRAFT', 'IN_USE', 'EVALUATED', 'IMPROVABLE', 'ARCHIVED');
CREATE TYPE "PedagogicalVisibility" AS ENUM ('PRIVATE', 'AREA', 'INSTITUTION');

CREATE TABLE "PedagogicalDesign" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "boardId" TEXT,
    "subjectId" TEXT,
    "gradeId" TEXT,
    "groupId" TEXT,
    "experienceType" "PedagogicalExperienceType" NOT NULL DEFAULT 'LESSON_PLAN',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "PedagogicalDesignStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "PedagogicalVisibility" NOT NULL DEFAULT 'PRIVATE',
    "dna" JSONB,
    "sourceDesignId" TEXT,
    "aiProviderUsed" TEXT,
    "aiModelUsed" TEXT,
    "aiTokens" INTEGER,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PedagogicalDesign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PedagogicalDesign_teacherId_institutionId_idx" ON "PedagogicalDesign"("teacherId", "institutionId");
CREATE INDEX "PedagogicalDesign_boardId_idx" ON "PedagogicalDesign"("boardId");
CREATE INDEX "PedagogicalDesign_institutionId_visibility_idx" ON "PedagogicalDesign"("institutionId", "visibility");

CREATE TABLE "PedagogicalDesignVersion" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdByAi" BOOLEAN NOT NULL DEFAULT false,
    "evidenceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PedagogicalDesignVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PedagogicalDesignVersion_designId_versionNumber_key" ON "PedagogicalDesignVersion"("designId", "versionNumber");
CREATE INDEX "PedagogicalDesignVersion_designId_idx" ON "PedagogicalDesignVersion"("designId");

ALTER TABLE "PedagogicalDesign" ADD CONSTRAINT "PedagogicalDesign_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedagogicalDesignVersion" ADD CONSTRAINT "PedagogicalDesignVersion_designId_fkey" FOREIGN KEY ("designId") REFERENCES "PedagogicalDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
