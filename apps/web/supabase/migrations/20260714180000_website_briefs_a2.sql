-- Prompt A2: document website_briefs brief + ai_provenance contracts (table from Site Studio migration).
-- Additive only — no destructive changes.

COMMENT ON TABLE public.website_briefs IS
  'Site Studio structured brief (schemaVersion 1.0 in brief JSON). Powers sitemap/wireframe/SEO AI.';

COMMENT ON COLUMN public.website_briefs.brief IS
  'WebsiteBrief JSON. Must include schemaVersion: ''1.0''. Shape: org, brand, offer, audience, conversation, competitors, references, stackPreference.';

COMMENT ON COLUMN public.website_briefs.ai_provenance IS
  'Per-field AI provenance: fields[path] = { source: notes|url|crm, model, suggestedAt, status: suggested|confirmed|human_edited }; optional lastRun.';

-- Prefer new rows to declare schema version (empty {}.normalize on read still works).
ALTER TABLE public.website_briefs
  ALTER COLUMN brief SET DEFAULT '{"schemaVersion":"1.0"}'::jsonb;

-- Re-assert RLS posture (idempotent): team members read; jobs.edit write; no clients/contractors.
DO $$
BEGIN
  IF to_regclass('public.website_briefs') IS NULL THEN
    RAISE NOTICE 'website_briefs missing — apply Site Studio migration first';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS website_briefs_select ON public.website_briefs';
  EXECUTE $policy$
    CREATE POLICY website_briefs_select ON public.website_briefs
      FOR SELECT TO authenticated
      USING (
        public.has_role_on_account (account_id)
        AND NOT public.is_client_on_account (account_id)
        AND NOT public.is_contractor_on_account (account_id)
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS website_briefs_insert ON public.website_briefs';
  EXECUTE $policy$
    CREATE POLICY website_briefs_insert ON public.website_briefs
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission (auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account (account_id)
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS website_briefs_update ON public.website_briefs';
  EXECUTE $policy$
    CREATE POLICY website_briefs_update ON public.website_briefs
      FOR UPDATE TO authenticated
      USING (
        public.has_permission (auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account (account_id)
      )
      WITH CHECK (
        public.has_permission (auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account (account_id)
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS website_briefs_delete ON public.website_briefs';
  EXECUTE $policy$
    CREATE POLICY website_briefs_delete ON public.website_briefs
      FOR DELETE TO authenticated
      USING (
        public.has_permission (auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account (account_id)
      )
  $policy$;
END
$$;
