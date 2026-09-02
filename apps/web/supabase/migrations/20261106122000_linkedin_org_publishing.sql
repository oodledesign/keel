-- LinkedIn organization (company page) publishing for commercial disposals.

CREATE TABLE IF NOT EXISTS public.linkedin_org_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  org_id text NOT NULL,
  org_urn text NOT NULL,
  org_name text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  connected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'needs_reconnect', 'disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_org_connections_one_per_workspace UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS public.listing_linkedin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  image_media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  overlay_first boolean NOT NULL DEFAULT true,
  listing_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'posting', 'posted', 'failed')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  linkedin_post_urn text,
  error text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_linkedin_org_connections_account_id
  ON public.linkedin_org_connections (account_id);

CREATE INDEX IF NOT EXISTS ix_listing_linkedin_posts_listing
  ON public.listing_linkedin_posts (listing_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_listing_linkedin_posts_account
  ON public.listing_linkedin_posts (account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_listing_linkedin_posts_scheduled
  ON public.listing_linkedin_posts (scheduled_at)
  WHERE status = 'scheduled';

ALTER TABLE public.linkedin_org_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_linkedin_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linkedin_org_connections_select ON public.linkedin_org_connections;
CREATE POLICY linkedin_org_connections_select ON public.linkedin_org_connections
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS linkedin_org_connections_insert ON public.linkedin_org_connections;
CREATE POLICY linkedin_org_connections_insert ON public.linkedin_org_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS linkedin_org_connections_update ON public.linkedin_org_connections;
CREATE POLICY linkedin_org_connections_update ON public.linkedin_org_connections
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS linkedin_org_connections_delete ON public.linkedin_org_connections;
CREATE POLICY linkedin_org_connections_delete ON public.linkedin_org_connections
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS listing_linkedin_posts_select ON public.listing_linkedin_posts;
CREATE POLICY listing_linkedin_posts_select ON public.listing_linkedin_posts
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS listing_linkedin_posts_insert ON public.listing_linkedin_posts;
CREATE POLICY listing_linkedin_posts_insert ON public.listing_linkedin_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS listing_linkedin_posts_update ON public.listing_linkedin_posts;
CREATE POLICY listing_linkedin_posts_update ON public.listing_linkedin_posts
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS listing_linkedin_posts_delete ON public.listing_linkedin_posts;
CREATE POLICY listing_linkedin_posts_delete ON public.listing_linkedin_posts
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  );

DROP TRIGGER IF EXISTS linkedin_org_connections_set_timestamps
  ON public.linkedin_org_connections;
CREATE TRIGGER linkedin_org_connections_set_timestamps
  BEFORE INSERT OR UPDATE ON public.linkedin_org_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS listing_linkedin_posts_set_timestamps
  ON public.listing_linkedin_posts;
CREATE TRIGGER listing_linkedin_posts_set_timestamps
  BEFORE INSERT OR UPDATE ON public.listing_linkedin_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_org_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_linkedin_posts TO authenticated;
GRANT ALL ON public.linkedin_org_connections, public.listing_linkedin_posts
  TO postgres, service_role;

COMMENT ON TABLE public.linkedin_org_connections IS
  'LinkedIn organization (company page) connected for organic disposal posts. Tokens encrypted at rest.';
COMMENT ON TABLE public.listing_linkedin_posts IS
  'Draft, scheduled, and published LinkedIn company-page posts for a commercial disposal.';
COMMENT ON COLUMN public.linkedin_org_connections.access_token IS
  'Encrypted at rest (see lib/instagram-autoreply/token-crypto).';
COMMENT ON COLUMN public.linkedin_org_connections.refresh_token IS
  'Encrypted at rest when LinkedIn issues a refresh token.';
