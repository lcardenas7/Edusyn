-- Portada del proyecto (Nivel 1). Columna aditiva; AbpProject ya tiene su RLS.
ALTER TABLE "AbpProject" ADD COLUMN "presentation" JSONB;
