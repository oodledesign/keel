-- Prompt F1: Ozer Sites — live hosted Puck sites (same Supabase project as Site Studio).
-- Public published reads go through service-role renderer only; workspace RLS for editing.

CREATE TABLE IF NOT EXISTS public.site_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites (id) ON DELETE SET NULL,
  name text NOT NULL,
  primary_domain text,
  subdomain text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'live', 'offline')),
  theme_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_sites_subdomain_unique UNIQUE (subdomain)
);

COMMENT ON TABLE public.site_sites IS
  'Ozer Sites (F1): live/hosted site keyed by workspace account_id.';
COMMENT ON COLUMN public.site_sites.settings IS
  'Per-site flags e.g. clientCanDelete, clientCanInsert, clientCanDrag, portalEditEnabled.';
COMMENT ON COLUMN public.site_sites.theme_tokens IS
  'D1 style tokens applied as --sb-* CSS variables in the public renderer.';

CREATE INDEX IF NOT EXISTS ix_site_sites_account_id
  ON public.site_sites (account_id);
CREATE INDEX IF NOT EXISTS ix_site_sites_website_id
  ON public.site_sites (website_id);

CREATE TABLE IF NOT EXISTS public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.site_sites (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  puck_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  published_data jsonb,
  source_hash text,
  human_edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT site_pages_site_slug_unique UNIQUE (site_id, slug)
);

COMMENT ON TABLE public.site_pages IS
  'Ozer Sites pages: draft puck_data + published_data snapshot; source_hash for re-publish conflicts.';
COMMENT ON COLUMN public.site_pages.source_hash IS
  'Hash of last Site Studio–driven publish payload; human edits set human_edited_at.';

CREATE INDEX IF NOT EXISTS ix_site_pages_site_id
  ON public.site_pages (site_id);

CREATE TABLE IF NOT EXISTS public.site_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.site_sites (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  hostname text NOT NULL,
  verified_at timestamptz,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_domains_hostname_unique UNIQUE (hostname)
);

COMMENT ON TABLE public.site_domains IS
  'Custom hostnames for Ozer Sites; verified_at set after DNS ownership check.';

CREATE INDEX IF NOT EXISTS ix_site_domains_site_id
  ON public.site_domains (site_id);

-- Timestamps
DROP TRIGGER IF EXISTS site_sites_set_timestamps ON public.site_sites;
CREATE TRIGGER site_sites_set_timestamps
  BEFORE INSERT OR UPDATE ON public.site_sites
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS site_pages_set_timestamps ON public.site_pages;
CREATE TRIGGER site_pages_set_timestamps
  BEFORE INSERT OR UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.site_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.site_sites, public.site_pages, public.site_domains
  TO authenticated, service_role;

-- Workspace members (non-client / non-contractor) can manage sites.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_sites', 'site_pages', 'site_domains'] LOOP
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

-- Storage: site media under account_image/{accountId}/sites/...
-- Writes enforced in API routes (team OR portal client_members).
