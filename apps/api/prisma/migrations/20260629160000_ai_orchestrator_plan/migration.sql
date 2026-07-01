-- ORQUESTADOR DE IA · plan por institución (aditivo)
CREATE TYPE "AiTier" AS ENUM ('FREE', 'PREMIUM', 'BYOK');

CREATE TABLE "InstitutionAiPlan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "tier" "AiTier" NOT NULL DEFAULT 'FREE',
    "modelOverride" TEXT,
    "monthlyTokenQuota" INTEGER NOT NULL DEFAULT 2000000,
    "tokensUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "periodResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byokApiKeyRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstitutionAiPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstitutionAiPlan_institutionId_key" ON "InstitutionAiPlan"("institutionId");
CREATE INDEX "InstitutionAiPlan_institutionId_idx" ON "InstitutionAiPlan"("institutionId");
