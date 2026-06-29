-- WORKSPACE V2 · F10 — Proyecto (aditivo)
CREATE TABLE "WorkspaceProject" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "competencies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceProject_boardId_idx" ON "WorkspaceProject"("boardId");

CREATE TABLE "WorkspaceProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceProjectTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceProjectTask_projectId_idx" ON "WorkspaceProjectTask"("projectId");

CREATE TABLE "WorkspaceProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceProjectMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceProjectMember_projectId_idx" ON "WorkspaceProjectMember"("projectId");

ALTER TABLE "WorkspaceProject" ADD CONSTRAINT "WorkspaceProject_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceProjectTask" ADD CONSTRAINT "WorkspaceProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceProjectMember" ADD CONSTRAINT "WorkspaceProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WorkspaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
