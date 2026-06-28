-- WORKSPACE V2 · F5 — Bitácora: tipo de entrada y destacado (aditivo)
ALTER TABLE "WorkspaceItem"
  ADD COLUMN "entryType"   TEXT,
  ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false;
