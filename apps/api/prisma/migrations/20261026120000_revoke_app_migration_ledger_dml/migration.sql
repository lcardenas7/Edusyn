-- El rol de aplicación no debe modificar el historial que controla Prisma.
-- El migrador actúa como edusyn_owner y conserva los privilegios de propiedad.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;

DO $$
DECLARE ledger_owner text;
BEGIN
  IF current_user <> 'edusyn_owner' THEN
    RAISE EXCEPTION 'Migration ledger: aplicar como edusyn_owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'edusyn_app' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
  ) THEN
    RAISE EXCEPTION 'Migration ledger: edusyn_app ausente o incompatible';
  END IF;

  SELECT pg_get_userbyid(relowner) INTO ledger_owner
  FROM pg_class
  WHERE oid = to_regclass('public."_prisma_migrations"') AND relkind = 'r';
  IF ledger_owner IS DISTINCT FROM 'edusyn_owner' THEN
    RAISE EXCEPTION 'Migration ledger: tabla ausente o propiedad inesperada (%)', ledger_owner;
  END IF;

  REVOKE INSERT, UPDATE, DELETE ON TABLE public."_prisma_migrations" FROM edusyn_app;

  IF has_table_privilege('edusyn_app', 'public."_prisma_migrations"', 'INSERT')
    OR has_table_privilege('edusyn_app', 'public."_prisma_migrations"', 'UPDATE')
    OR has_table_privilege('edusyn_app', 'public."_prisma_migrations"', 'DELETE') THEN
    RAISE EXCEPTION 'Migration ledger: edusyn_app conserva privilegios DML';
  END IF;
END $$;

COMMIT;
