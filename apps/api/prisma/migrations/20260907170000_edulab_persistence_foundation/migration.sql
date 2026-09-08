-- EduLab persistence foundation: immutable global catalog plus tenant/user-owned streams.
-- Forward-only and additive. Does not modify historical tables or rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;

DO $$
DECLARE
  role_name text;
  table_name text;
  helper_id oid;
  helper_body text;
BEGIN
  IF current_user <> 'edusyn_owner' THEN
    RAISE EXCEPTION 'EduLab preflight: migrate as edusyn_owner';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['edusyn_owner', 'edusyn_migrator', 'edusyn_app'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolname = role_name
        AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb
        AND NOT rolcreaterole AND NOT rolreplication
        AND rolcanlogin = (role_name <> 'edusyn_owner')
    ) THEN
      RAISE EXCEPTION 'EduLab preflight: role % missing or incompatible', role_name;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'edusyn_app'::regrole)
    OR NOT pg_has_role('edusyn_migrator', 'edusyn_owner', 'MEMBER')
    OR has_schema_privilege('edusyn_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'EduLab preflight: role membership or schema grants incompatible';
  END IF;

  helper_id := to_regprocedure('public.current_institution_id()');
  IF helper_id IS NULL THEN
    RAISE EXCEPTION 'EduLab preflight: current_institution_id() contract is missing';
  END IF;
  SELECT regexp_replace(lower(prosrc), '[[:space:];]', '', 'g')
    INTO helper_body FROM pg_proc WHERE oid = helper_id;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = helper_id AND p.prorettype = 'text'::regtype
      AND NOT p.prosecdef AND p.provolatile = 's' AND l.lanname = 'sql'
      AND p.proowner = 'edusyn_owner'::regrole AND NOT p.proretset
      AND (p.proconfig IS NULL OR p.proconfig = ARRAY['search_path=pg_catalog'])
  ) OR helper_body IS DISTINCT FROM
    'selectnullif(current_setting(''app.current_institution'',true),'''')' THEN
    RAISE EXCEPTION 'EduLab preflight: current_institution_id() contract is incompatible';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'EduLabExperience', 'EduLabAssetPack', 'EduLabAttempt', 'EduLabEvent'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'EduLab preflight: table % already exists; refusing drift', table_name;
    END IF;
  END LOOP;

  helper_id := to_regprocedure('public.current_edulab_user_id()');
  IF helper_id IS NOT NULL THEN
    SELECT regexp_replace(lower(prosrc), '[[:space:];]', '', 'g')
      INTO helper_body FROM pg_proc WHERE oid = helper_id;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
      WHERE p.oid = helper_id AND p.prorettype = 'text'::regtype
        AND NOT p.prosecdef AND p.provolatile = 's' AND l.lanname = 'sql'
        AND p.proowner = 'edusyn_owner'::regrole AND NOT p.proretset
        AND (p.proconfig IS NULL OR p.proconfig = ARRAY['search_path=pg_catalog'])
    ) OR helper_body IS DISTINCT FROM
      'selectnullif(current_setting(''app.current_user'',true),'''')' THEN
      RAISE EXCEPTION 'EduLab preflight: existing user helper is incompatible';
    END IF;
  ELSE
    EXECUTE $function$CREATE FUNCTION public.current_edulab_user_id() RETURNS text
      LANGUAGE sql STABLE PARALLEL SAFE SECURITY INVOKER SET search_path=pg_catalog AS
      'SELECT NULLIF(current_setting(''app.current_user'', true), '''')'$function$;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.current_edulab_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_edulab_user_id() TO edusyn_app;

CREATE TABLE public."EduLabExperience" (
  "id" text NOT NULL,
  "definitionId" text NOT NULL,
  "version" integer NOT NULL,
  "schemaVersion" text NOT NULL,
  "engineVersion" text NOT NULL,
  "contentHash" text NOT NULL,
  "runtimeDefinitionHash" text NOT NULL,
  "title" text NOT NULL,
  "definition" jsonb NOT NULL,
  "assetPackRefs" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "availability" text NOT NULL DEFAULT 'AVAILABLE',
  "publishedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" timestamp(3),
  CONSTRAINT "EduLabExperience_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EduLabExperience_version_check" CHECK ("version" > 0),
  CONSTRAINT "EduLabExperience_definition_check" CHECK (jsonb_typeof("definition") = 'object'),
  CONSTRAINT "EduLabExperience_asset_refs_check" CHECK (jsonb_typeof("assetPackRefs") = 'array'),
  CONSTRAINT "EduLabExperience_availability_check" CHECK ("availability" IN ('AVAILABLE', 'RETIRED')),
  CONSTRAINT "EduLabExperience_content_hash_check" CHECK ("contentHash" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "EduLabExperience_runtime_hash_check" CHECK ("runtimeDefinitionHash" ~ '^edulab-fnv1a32-[0-9a-f]{8}$'),
  CONSTRAINT "EduLabExperience_definitionId_version_key" UNIQUE ("definitionId", "version"),
  CONSTRAINT "EduLabExperience_contentHash_key" UNIQUE ("contentHash"),
  CONSTRAINT "EduLabExperience_replay_reference_key" UNIQUE
    ("id", "definitionId", "version", "contentHash", "runtimeDefinitionHash", "engineVersion")
);

CREATE TABLE public."EduLabAssetPack" (
  "id" text NOT NULL,
  "packId" text NOT NULL,
  "version" integer NOT NULL,
  "contentHash" text NOT NULL,
  "manifest" jsonb NOT NULL,
  "storagePrefix" text NOT NULL,
  "totalBytes" bigint NOT NULL,
  "availability" text NOT NULL DEFAULT 'AVAILABLE',
  "publishedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" timestamp(3),
  CONSTRAINT "EduLabAssetPack_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EduLabAssetPack_version_check" CHECK ("version" > 0),
  CONSTRAINT "EduLabAssetPack_manifest_check" CHECK (jsonb_typeof("manifest") = 'object'),
  CONSTRAINT "EduLabAssetPack_bytes_check" CHECK ("totalBytes" >= 0),
  CONSTRAINT "EduLabAssetPack_availability_check" CHECK ("availability" IN ('AVAILABLE', 'RETIRED')),
  CONSTRAINT "EduLabAssetPack_content_hash_check" CHECK ("contentHash" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "EduLabAssetPack_packId_version_key" UNIQUE ("packId", "version"),
  CONSTRAINT "EduLabAssetPack_contentHash_key" UNIQUE ("contentHash")
);

CREATE TABLE public."EduLabAttempt" (
  "id" text NOT NULL,
  "institutionId" text NOT NULL,
  "userId" text NOT NULL,
  "clientAttemptId" text NOT NULL,
  "experienceId" text NOT NULL,
  "definitionId" text NOT NULL,
  "definitionVersion" integer NOT NULL,
  "contentHash" text NOT NULL,
  "runtimeDefinitionHash" text NOT NULL,
  "engineVersion" text NOT NULL,
  "mode" text NOT NULL,
  "seed" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "endingId" text,
  "stateHash" text NOT NULL,
  "logicalTick" integer NOT NULL DEFAULT 0,
  "decisionSequence" integer NOT NULL DEFAULT 0,
  "engineEventSequence" integer NOT NULL DEFAULT 0,
  "streamSequence" bigint NOT NULL DEFAULT 0,
  "concurrencyVersion" integer NOT NULL DEFAULT 0,
  "checkpointId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" timestamp(3),
  CONSTRAINT "EduLabAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EduLabAttempt_definition_version_check" CHECK ("definitionVersion" > 0),
  CONSTRAINT "EduLabAttempt_content_hash_check" CHECK ("contentHash" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "EduLabAttempt_runtime_hash_check" CHECK ("runtimeDefinitionHash" ~ '^edulab-fnv1a32-[0-9a-f]{8}$'),
  CONSTRAINT "EduLabAttempt_mode_check" CHECK ("mode" IN ('EXPLORE', 'GUIDED_PRACTICE')),
  CONSTRAINT "EduLabAttempt_status_check" CHECK ("status" IN ('ACTIVE', 'COMPLETED', 'ABANDONED')),
  CONSTRAINT "EduLabAttempt_sequences_check" CHECK (
    "logicalTick" >= 0 AND "decisionSequence" >= 0 AND "engineEventSequence" >= 0
    AND "streamSequence" >= 0 AND "concurrencyVersion" >= 0
  ),
  CONSTRAINT "EduLabAttempt_institution_fkey" FOREIGN KEY ("institutionId")
    REFERENCES public."Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EduLabAttempt_user_fkey" FOREIGN KEY ("userId")
    REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EduLabAttempt_experience_replay_fkey" FOREIGN KEY
    ("experienceId", "definitionId", "definitionVersion", "contentHash", "runtimeDefinitionHash", "engineVersion")
    REFERENCES public."EduLabExperience"
    ("id", "definitionId", "version", "contentHash", "runtimeDefinitionHash", "engineVersion")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "EduLabAttempt_institutionId_userId_clientAttemptId_key"
    UNIQUE ("institutionId", "userId", "clientAttemptId"),
  CONSTRAINT "EduLabAttempt_id_institution_key" UNIQUE ("id", "institutionId")
);

CREATE INDEX "EduLabAttempt_owner_status_idx"
  ON public."EduLabAttempt"("institutionId", "userId", "status", "updatedAt");
CREATE INDEX "EduLabAttempt_experience_idx" ON public."EduLabAttempt"("experienceId");

CREATE TABLE public."EduLabEvent" (
  "id" text NOT NULL,
  "institutionId" text NOT NULL,
  "attemptId" text NOT NULL,
  "streamSequence" bigint NOT NULL,
  "kind" text NOT NULL,
  "eventType" text NOT NULL,
  "intentId" text,
  "decisionSequence" integer NOT NULL,
  "engineEventSequence" integer,
  "logicalTick" integer NOT NULL,
  "idempotencyKey" text NOT NULL,
  "causationId" text,
  "correlationId" text NOT NULL,
  "payload" jsonb NOT NULL,
  "payloadHash" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EduLabEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EduLabEvent_stream_sequence_check" CHECK ("streamSequence" > 0),
  CONSTRAINT "EduLabEvent_kind_check" CHECK ("kind" IN ('INTENT_ACCEPTED', 'DOMAIN_EVENT', 'CHECKPOINT', 'ATTEMPT_FINISHED')),
  CONSTRAINT "EduLabEvent_decision_sequence_check" CHECK ("decisionSequence" >= 0),
  CONSTRAINT "EduLabEvent_engine_sequence_check" CHECK ("engineEventSequence" IS NULL OR "engineEventSequence" > 0),
  CONSTRAINT "EduLabEvent_logical_tick_check" CHECK ("logicalTick" >= 0),
  CONSTRAINT "EduLabEvent_payload_check" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "EduLabEvent_payload_hash_check" CHECK ("payloadHash" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "EduLabEvent_institution_fkey" FOREIGN KEY ("institutionId")
    REFERENCES public."Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EduLabEvent_attempt_tenant_fkey" FOREIGN KEY ("attemptId", "institutionId")
    REFERENCES public."EduLabAttempt"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EduLabEvent_attemptId_streamSequence_key" UNIQUE ("attemptId", "streamSequence"),
  CONSTRAINT "EduLabEvent_attemptId_idempotencyKey_key" UNIQUE ("attemptId", "idempotencyKey")
);

CREATE UNIQUE INDEX "EduLabEvent_engine_sequence_key"
  ON public."EduLabEvent"("attemptId", "engineEventSequence")
  WHERE "engineEventSequence" IS NOT NULL;
CREATE INDEX "EduLabEvent_tenant_attempt_idx"
  ON public."EduLabEvent"("institutionId", "attemptId", "streamSequence");

REVOKE ALL ON public."EduLabExperience", public."EduLabAssetPack",
  public."EduLabAttempt", public."EduLabEvent" FROM PUBLIC;
REVOKE ALL ON public."EduLabExperience", public."EduLabAssetPack",
  public."EduLabAttempt", public."EduLabEvent" FROM edusyn_app;

GRANT SELECT ON public."EduLabExperience", public."EduLabAssetPack" TO edusyn_app;
GRANT SELECT, INSERT ON public."EduLabAttempt" TO edusyn_app;
GRANT UPDATE ("status", "endingId", "stateHash", "logicalTick", "decisionSequence",
  "engineEventSequence", "streamSequence", "concurrencyVersion", "checkpointId",
  "updatedAt", "completedAt") ON public."EduLabAttempt" TO edusyn_app;
GRANT SELECT, INSERT ON public."EduLabEvent" TO edusyn_app;

ALTER TABLE public."EduLabAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EduLabAttempt" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."EduLabEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EduLabEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY edulab_attempt_select_own ON public."EduLabAttempt"
  FOR SELECT TO edusyn_app
  USING ("institutionId" = public.current_institution_id()
    AND "userId" = public.current_edulab_user_id());
CREATE POLICY edulab_attempt_insert_own ON public."EduLabAttempt"
  FOR INSERT TO edusyn_app
  WITH CHECK ("institutionId" = public.current_institution_id()
    AND "userId" = public.current_edulab_user_id());
CREATE POLICY edulab_attempt_update_own ON public."EduLabAttempt"
  FOR UPDATE TO edusyn_app
  USING ("institutionId" = public.current_institution_id()
    AND "userId" = public.current_edulab_user_id())
  WITH CHECK ("institutionId" = public.current_institution_id()
    AND "userId" = public.current_edulab_user_id());

CREATE POLICY edulab_event_select_own ON public."EduLabEvent"
  FOR SELECT TO edusyn_app
  USING ("institutionId" = public.current_institution_id() AND EXISTS (
    SELECT 1 FROM public."EduLabAttempt" attempt
    WHERE attempt."id" = "EduLabEvent"."attemptId"
      AND attempt."institutionId" = "EduLabEvent"."institutionId"
      AND attempt."userId" = public.current_edulab_user_id()
  ));
CREATE POLICY edulab_event_insert_own ON public."EduLabEvent"
  FOR INSERT TO edusyn_app
  WITH CHECK ("institutionId" = public.current_institution_id() AND EXISTS (
    SELECT 1 FROM public."EduLabAttempt" attempt
    WHERE attempt."id" = "EduLabEvent"."attemptId"
      AND attempt."institutionId" = "EduLabEvent"."institutionId"
      AND attempt."userId" = public.current_edulab_user_id()
  ));

DO $$
DECLARE table_name text; relation_id oid;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['EduLabAttempt', 'EduLabEvent'] LOOP
    relation_id := to_regclass(format('public.%I', table_name));
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = relation_id
        AND relowner = 'edusyn_owner'::regrole AND relrowsecurity AND relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'EduLab postcondition: ownership/RLS failed for %', table_name;
    END IF;
    IF has_table_privilege('edusyn_app', relation_id, 'DELETE')
      OR has_table_privilege('edusyn_app', relation_id, 'TRUNCATE')
      OR has_table_privilege('edusyn_app', relation_id, 'REFERENCES')
      OR has_table_privilege('edusyn_app', relation_id, 'TRIGGER') THEN
      RAISE EXCEPTION 'EduLab postcondition: destructive privilege leaked on %', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('edusyn_app', 'public."EduLabEvent"', 'UPDATE')
    OR NOT has_table_privilege('edusyn_app', 'public."EduLabEvent"', 'SELECT')
    OR NOT has_table_privilege('edusyn_app', 'public."EduLabEvent"', 'INSERT') THEN
    RAISE EXCEPTION 'EduLab postcondition: Event is not append-only';
  END IF;

  IF NOT has_table_privilege('edusyn_app', 'public."EduLabExperience"', 'SELECT')
    OR NOT has_table_privilege('edusyn_app', 'public."EduLabAssetPack"', 'SELECT')
    OR has_table_privilege('edusyn_app', 'public."EduLabExperience"', 'INSERT')
    OR has_table_privilege('edusyn_app', 'public."EduLabExperience"', 'UPDATE')
    OR has_table_privilege('edusyn_app', 'public."EduLabExperience"', 'DELETE')
    OR has_table_privilege('edusyn_app', 'public."EduLabAssetPack"', 'INSERT')
    OR has_table_privilege('edusyn_app', 'public."EduLabAssetPack"', 'UPDATE')
    OR has_table_privilege('edusyn_app', 'public."EduLabAssetPack"', 'DELETE') THEN
    RAISE EXCEPTION 'EduLab postcondition: global catalog grants are not read-only';
  END IF;
END $$;

COMMIT;
