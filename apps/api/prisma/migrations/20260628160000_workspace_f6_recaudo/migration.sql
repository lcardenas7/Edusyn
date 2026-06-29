-- WORKSPACE V2 · F6 — Recaudo relacional (aditivo)
CREATE TABLE "WorkspaceCollection" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitValue" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceCollection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceCollection_boardId_idx" ON "WorkspaceCollection"("boardId");

CREATE TABLE "WorkspaceCollectionCharge" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceCollectionCharge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceCollectionCharge_collectionId_idx" ON "WorkspaceCollectionCharge"("collectionId");
CREATE INDEX "WorkspaceCollectionCharge_studentId_idx" ON "WorkspaceCollectionCharge"("studentId");

CREATE TABLE "WorkspaceCollectionPayment" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "WorkspaceCollectionPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceCollectionPayment_chargeId_idx" ON "WorkspaceCollectionPayment"("chargeId");

ALTER TABLE "WorkspaceCollection" ADD CONSTRAINT "WorkspaceCollection_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceCollectionCharge" ADD CONSTRAINT "WorkspaceCollectionCharge_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "WorkspaceCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceCollectionPayment" ADD CONSTRAINT "WorkspaceCollectionPayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "WorkspaceCollectionCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
