-- CreateEnum
CREATE TYPE "AbpResourceType" AS ENUM ('PDF', 'VIDEO', 'LINK', 'DOC', 'OTHER');

-- DropIndex

-- CreateTable
CREATE TABLE "AbpResource" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AbpResourceType" NOT NULL DEFAULT 'LINK',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbpResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpAnnouncement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbpResource_institutionId_idx" ON "AbpResource"("institutionId");

-- CreateIndex
CREATE INDEX "AbpResource_projectId_idx" ON "AbpResource"("projectId");

-- CreateIndex
CREATE INDEX "AbpAnnouncement_institutionId_idx" ON "AbpAnnouncement"("institutionId");

-- CreateIndex
CREATE INDEX "AbpAnnouncement_projectId_idx" ON "AbpAnnouncement"("projectId");

-- AddForeignKey
ALTER TABLE "AbpResource" ADD CONSTRAINT "AbpResource_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpResource" ADD CONSTRAINT "AbpResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AbpProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpAnnouncement" ADD CONSTRAINT "AbpAnnouncement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpAnnouncement" ADD CONSTRAINT "AbpAnnouncement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AbpProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex

-- RenameIndex

-- RLS multi-tenant por tabla (patron tenant-scoped, defensivo).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpResource" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpResource" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpResource' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpResource" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpAnnouncement" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpAnnouncement" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpAnnouncement' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpAnnouncement" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
