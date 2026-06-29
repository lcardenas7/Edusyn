-- WORKSPACE V2 · F7 — Roles del salón (aditivo)
CREATE TABLE "WorkspaceRole" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceRole_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceRole_boardId_idx" ON "WorkspaceRole"("boardId");

CREATE TABLE "WorkspaceRoleAssignment" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentPhoto" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "WorkspaceRoleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceRoleAssignment_roleId_idx" ON "WorkspaceRoleAssignment"("roleId");
CREATE INDEX "WorkspaceRoleAssignment_studentId_idx" ON "WorkspaceRoleAssignment"("studentId");

ALTER TABLE "WorkspaceRole" ADD CONSTRAINT "WorkspaceRole_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRoleAssignment" ADD CONSTRAINT "WorkspaceRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
