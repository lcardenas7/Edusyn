-- Branding institucional de fuente única: color de marca en el perfil de la institución.
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT DEFAULT '#1E3A8A';
