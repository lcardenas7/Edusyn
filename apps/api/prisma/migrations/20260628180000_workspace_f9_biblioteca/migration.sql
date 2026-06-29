-- WORKSPACE V2 · F9 — Biblioteca (aditivo)
CREATE TABLE "WorkspaceResourceFolder" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceResourceFolder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceResourceFolder_boardId_idx" ON "WorkspaceResourceFolder"("boardId");

CREATE TABLE "WorkspaceResource" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FILE',
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceResource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceResource_boardId_idx" ON "WorkspaceResource"("boardId");
CREATE INDEX "WorkspaceResource_folderId_idx" ON "WorkspaceResource"("folderId");

ALTER TABLE "WorkspaceResourceFolder" ADD CONSTRAINT "WorkspaceResourceFolder_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceResource" ADD CONSTRAINT "WorkspaceResource_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceResource" ADD CONSTRAINT "WorkspaceResource_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "WorkspaceResourceFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
