-- Banco de Formatos de Boletín (docs/DISENO_BANCO_FORMATOS_BOLETIN.md §6, §7.2).
-- Skin institucional: tokens de color sobreescribibles + default general de plantilla.
-- Aditiva: solo columnas opcionales nuevas en ReportCardConfig.

ALTER TABLE "ReportCardConfig" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "ReportCardConfig" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "ReportCardConfig" ADD COLUMN IF NOT EXISTS "headerBgColor" TEXT;
ALTER TABLE "ReportCardConfig" ADD COLUMN IF NOT EXISTS "tableStripeColor" TEXT;
ALTER TABLE "ReportCardConfig" ADD COLUMN IF NOT EXISTS "textColor" TEXT;
ALTER TABLE "ReportCardConfig" ADD COLUMN IF NOT EXISTS "defaultTemplateKey" TEXT;
