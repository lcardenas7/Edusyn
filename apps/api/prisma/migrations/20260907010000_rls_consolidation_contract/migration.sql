-- Contrato reproducible del perímetro aprobado: tres pilotos + auditoría de
-- notas + auditoría de emisión. No expande RLS a autenticación, ABP o EduLab.
-- Forward-only: no modifica filas ni migraciones históricas.
-- Requiere el bootstrap de roles existente; el migrador actúa como owner.
-- Transacción explícita: una incompatibilidad no deja activación parcial.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;
DO $$
DECLARE role_name text; table_name text; relation_id oid; policy_record record;
        helper_id oid; helper_body text;
        perimeter text[] := ARRAY['AchievementConfig','Achievement','StudentAchievement','GradeAuditEvent','ReportCardGenerationEvent'];
BEGIN
  IF current_user <> 'edusyn_owner' THEN
    RAISE EXCEPTION 'RLS preflight: migrar COMO edusyn_owner; no usar credencial de aplicación ni administrador';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['edusyn_owner','edusyn_migrator','edusyn_app'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name AND NOT rolsuper
      AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
      AND rolcanlogin = (role_name <> 'edusyn_owner')) THEN
      RAISE EXCEPTION 'RLS preflight: rol % ausente o incompatible', role_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member='edusyn_app'::regrole)
    OR NOT pg_has_role('edusyn_migrator','edusyn_owner','MEMBER')
    OR has_schema_privilege('edusyn_app','public','CREATE') THEN
    RAISE EXCEPTION 'RLS preflight: membresías o privilegios de esquema incompatibles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_default_acl d, LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole='edusyn_owner'::regrole AND d.defaclnamespace='public'::regnamespace
      AND d.defaclobjtype='r' AND a.grantee='edusyn_app'::regrole
    GROUP BY d.oid HAVING count(DISTINCT a.privilege_type) FILTER
      (WHERE a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE'))=4
  ) THEN RAISE EXCEPTION 'RLS preflight: faltan default privileges de owner a app'; END IF;

  -- Revisar TODO antes de crear función o activar tablas. No pisar drift.
  FOREACH table_name IN ARRAY perimeter LOOP
    relation_id := to_regclass(format('public.%I', table_name));
    IF relation_id IS NULL OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=relation_id
      AND relkind='r' AND relowner='edusyn_owner'::regrole) THEN
      RAISE EXCEPTION 'RLS preflight: tabla % ausente o propiedad pendiente', table_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=relation_id
      AND attname='institutionId' AND attnotnull AND atttypid='text'::regtype AND NOT attisdropped) THEN
      RAISE EXCEPTION 'RLS preflight: institutionId incompatible en %', table_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_attribute a
      ON a.attrelid=k.conrelid AND a.attname='institutionId'
      WHERE k.conrelid=relation_id AND k.contype='f' AND k.convalidated
        AND k.confrelid='public."Institution"'::regclass AND k.conkey=ARRAY[a.attnum]
        AND k.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.confrelid AND attname='id')]) THEN
      RAISE EXCEPTION 'RLS preflight: FK institucional ausente en %', table_name;
    END IF;
    IF NOT has_table_privilege('edusyn_app',relation_id,'SELECT')
      OR NOT has_table_privilege('edusyn_app',relation_id,'INSERT')
      OR NOT has_table_privilege('edusyn_app',relation_id,'UPDATE')
      OR NOT has_table_privilege('edusyn_app',relation_id,'DELETE')
      OR has_table_privilege('edusyn_app',relation_id,'TRUNCATE')
      OR has_table_privilege('edusyn_app',relation_id,'REFERENCES')
      OR has_table_privilege('edusyn_app',relation_id,'TRIGGER') THEN
      RAISE EXCEPTION 'RLS preflight: DML incompatible en %', table_name;
    END IF;
    FOR policy_record IN SELECT *, pg_get_expr(polqual,polrelid) AS using_expression,
      pg_get_expr(polwithcheck,polrelid) AS check_expression FROM pg_policy WHERE polrelid=relation_id LOOP
      IF policy_record.polname <> 'tenant_isolation' OR policy_record.polcmd <> '*'
        OR NOT policy_record.polpermissive OR policy_record.polroles <> ARRAY[0::oid]
        OR replace(policy_record.using_expression,'public.','') IS DISTINCT FROM '("institutionId" = current_institution_id())'
        OR replace(policy_record.check_expression,'public.','') IS DISTINCT FROM '("institutionId" = current_institution_id())' THEN
        RAISE EXCEPTION 'RLS preflight: policy incompatible en %, requiere revisión', table_name;
      END IF;
    END LOOP;
  END LOOP;

  helper_id := to_regprocedure('public.current_institution_id()');
  IF helper_id IS NOT NULL THEN
    SELECT regexp_replace(lower(prosrc), '[[:space:];]', '', 'g') INTO helper_body FROM pg_proc WHERE oid=helper_id;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=helper_id
      AND p.prorettype='text'::regtype AND NOT p.prosecdef AND p.provolatile='s'
      AND l.lanname='sql' AND p.proowner='edusyn_owner'::regrole AND NOT p.proretset
      AND (p.proconfig IS NULL OR p.proconfig=ARRAY['search_path=pg_catalog']))
      OR helper_body IS DISTINCT FROM 'selectnullif(current_setting(''app.current_institution'',true),'''')' THEN
      RAISE EXCEPTION 'RLS preflight: función existente incompatible; no se sobrescribe';
    END IF;
  ELSE
    EXECUTE $function$CREATE FUNCTION public.current_institution_id() RETURNS text
      LANGUAGE sql STABLE PARALLEL SAFE SECURITY INVOKER SET search_path=pg_catalog AS
      'SELECT NULLIF(current_setting(''app.current_institution'', true), '''')'$function$;
  END IF;
  IF NOT has_function_privilege('edusyn_app','public.current_institution_id()','EXECUTE') THEN
    RAISE EXCEPTION 'RLS preflight: app no puede ejecutar helper';
  END IF;
  FOREACH table_name IN ARRAY perimeter LOOP
    relation_id := to_regclass(format('public.%I', table_name));
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid=relation_id) THEN
      EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL USING ("institutionId" = public.current_institution_id()) WITH CHECK ("institutionId" = public.current_institution_id())', table_name);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=relation_id AND relrowsecurity AND relforcerowsecurity) THEN
      RAISE EXCEPTION 'RLS postcondition falló en %', table_name;
    END IF;
  END LOOP;
END $$;
COMMIT;
