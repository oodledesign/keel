-- Site Studio (Websites add-on): briefs, style systems, per-page SEO, share links, portal scope.

-- Portal (authenticated client org) visibility of planning artefacts.
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS portal_share_scope text NOT NULL DEFAULT 'off'
    CHECK (portal_share_scope IN ('off', 'sitemap', 'wireframes', 'full'));

COMMENT ON COLUMN public.websites.portal_share_scope IS
  'What planning artefacts the client portal shows: off | sitemap | wireframes | full.';

-- Structured AI brief per website (one row per website).
CREATE TABLE IF NOT EXISTS public.website_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid NOT NULL UNIQUE REFERENCES public.websites (id) ON DELETE CASCADE,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_briefs IS
  'Site Studio structured brief — single source of truth for sitemap/wireframe/SEO AI prompts.';

-- Style system tokens + moodboard per website (one row per website).
CREATE TABLE IF NOT EXISTS public.website_style_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid NOT NULL UNIQUE REFERENCES public.websites (id) ON DELETE CASCADE,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_style_systems IS
  'Site Studio design tokens (canvas/atmosphere/accent/contrast, type, radius) + moodboard refs.';

-- Per-page search readiness (SEO / GEO / AEO). page_id references sitemap JSONB page ids.
CREATE TABLE IF NOT EXISTS public.website_seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites (id) ON DELETE CASCADE,
  page_id uuid NOT NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, page_id)
);

COMMENT ON TABLE public.website_seo_pages IS
  'Site Studio search readiness per sitemap page: keywords, meta, outline, local SEO, answer blocks.';

CREATE INDEX IF NOT EXISTS ix_website_seo_pages_website_id
  ON public.website_seo_pages (website_id);

-- Public share links (token) scoped to sitemap / wireframes / design / full.
CREATE TABLE IF NOT EXISTS public.website_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'sitemap'
    CHECK (scope IN ('sitemap', 'wireframes', 'design', 'full')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_shares IS
  'Public read-only share links for Site Studio planning artefacts (mirrors proposals token pattern).';

CREATE INDEX IF NOT EXISTS ix_website_shares_website_id
  ON public.website_shares (website_id);

-- Timestamps triggers
DROP TRIGGER IF EXISTS website_briefs_set_timestamps ON public.website_briefs;
CREATE TRIGGER website_briefs_set_timestamps
  BEFORE INSERT OR UPDATE ON public.website_briefs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS website_style_systems_set_timestamps ON public.website_style_systems;
CREATE TRIGGER website_style_systems_set_timestamps
  BEFORE INSERT OR UPDATE ON public.website_style_systems
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS website_seo_pages_set_timestamps ON public.website_seo_pages;
CREATE TRIGGER website_seo_pages_set_timestamps
  BEFORE INSERT OR UPDATE ON public.website_seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS website_shares_set_timestamps ON public.website_shares;
CREATE TRIGGER website_shares_set_timestamps
  BEFORE INSERT OR UPDATE ON public.website_shares
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- RLS: same posture as website_content_docs (team members read; jobs.edit write).
ALTER TABLE public.website_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_style_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_shares ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.website_briefs, public.website_style_systems,
     public.website_seo_pages, public.website_shares
  TO authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'website_briefs', 'website_style_systems', 'website_seo_pages', 'website_shares'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_select ON public.%I
        FOR SELECT TO authenticated
        USING (
          public.has_role_on_account (account_id)
          AND NOT public.is_client_on_account (account_id)
          AND NOT public.is_contractor_on_account (account_id)
        )
    $f$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_insert ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (
          public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
          AND NOT public.is_contractor_on_account (account_id)
        )
    $f$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_update ON public.%I
        FOR UPDATE TO authenticated
        USING (
          public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
          AND NOT public.is_contractor_on_account (account_id)
        )
        WITH CHECK (
          public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
          AND NOT public.is_contractor_on_account (account_id)
        )
    $f$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_delete ON public.%I
        FOR DELETE TO authenticated
        USING (
          public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
          AND NOT public.is_contractor_on_account (account_id)
        )
    $f$, t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
