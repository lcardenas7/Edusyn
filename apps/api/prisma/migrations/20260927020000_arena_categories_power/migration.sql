ALTER TABLE "ClassroomDuel" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Mixta';
ALTER TABLE "ClassroomDuel" ADD COLUMN "selectionMode" TEXT NOT NULL DEFAULT 'CHOSEN';

CREATE TABLE "ClassroomDuelPowerUse" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "duelId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "options" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomDuelPowerUse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassroomDuelPowerUse_duelId_enrollmentId_key" ON "ClassroomDuelPowerUse"("duelId", "enrollmentId");
CREATE INDEX "ClassroomDuelPowerUse_institutionId_enrollmentId_idx" ON "ClassroomDuelPowerUse"("institutionId", "enrollmentId");
ALTER TABLE "ClassroomDuelPowerUse" ADD CONSTRAINT "ClassroomDuelPowerUse_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "ClassroomDuel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomDuelPowerUse" ADD CONSTRAINT "ClassroomDuelPowerUse_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    ALTER TABLE "ClassroomDuelPowerUse" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ClassroomDuelPowerUse" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "tenant_isolation" ON "ClassroomDuelPowerUse" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;

CREATE TABLE "QuestionBankCollection" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subjectArea" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionBankCollection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuestionBankCollection_institutionId_gradeId_isPublished_idx" ON "QuestionBankCollection"("institutionId", "gradeId", "isPublished");
CREATE INDEX "QuestionBankCollection_institutionId_createdById_idx" ON "QuestionBankCollection"("institutionId", "createdById");
ALTER TABLE "QuestionBankCollection" ADD CONSTRAINT "QuestionBankCollection_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuestionBankItem" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL,
  "text" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "explanation" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuestionBankItem_institutionId_collectionId_idx" ON "QuestionBankItem"("institutionId", "collectionId");
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "QuestionBankCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    ALTER TABLE "QuestionBankCollection" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "QuestionBankCollection" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "tenant_isolation" ON "QuestionBankCollection" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id());
    ALTER TABLE "QuestionBankItem" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "QuestionBankItem" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "tenant_isolation" ON "QuestionBankItem" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;
