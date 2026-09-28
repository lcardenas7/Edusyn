ALTER TABLE "QuestionBankCollection" ADD COLUMN "officialCatalogId" TEXT;
CREATE UNIQUE INDEX "QuestionBankCollection_institutionId_gradeId_officialCatalogId_key" ON "QuestionBankCollection"("institutionId", "gradeId", "officialCatalogId");
