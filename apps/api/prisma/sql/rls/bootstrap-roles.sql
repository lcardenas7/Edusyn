-- Bootstrap del modelo existente, SOLO para una base NUEVA y vacía.
-- Ejecutar con administración de clúster antes de migrate deploy.
-- No asigna credenciales. No ejecutar sobre staging/producción existentes.
-- Las funciones/policies se instalan AL FINAL del historial, nunca antes.
BEGIN;
DO $$
DECLARE role_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m','S')) THEN
    RAISE EXCEPTION 'Bootstrap requiere public vacío; no es un procedimiento de traslado de propiedad';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['edusyn_owner','edusyn_migrator','edusyn_app'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('CREATE ROLE %I %s NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
        role_name, CASE WHEN role_name='edusyn_owner' THEN 'NOLOGIN' ELSE 'LOGIN' END);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name AND
      (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR
       rolcanlogin <> (role_name <> 'edusyn_owner'))) THEN
      RAISE EXCEPTION 'Rol % incompatible; no se corrige automáticamente', role_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member='edusyn_app'::regrole) THEN
    RAISE EXCEPTION 'edusyn_app tiene membresías no previstas';
  END IF;
  GRANT edusyn_owner TO edusyn_migrator;
  -- Acotado a ESTA base: no cambia el arranque en otras bases del clúster.
  EXECUTE format('ALTER ROLE edusyn_migrator IN DATABASE %I SET role = edusyn_owner', current_database());
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO edusyn_owner;
GRANT USAGE ON SCHEMA public TO edusyn_app;
ALTER DEFAULT PRIVILEGES FOR ROLE edusyn_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edusyn_app;
COMMIT;
