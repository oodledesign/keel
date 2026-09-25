-- Competitor Tracker: market-watch listings + area watches (commercial property).
-- Separate from WIP instructions and disposals.

-- ---------------------------------------------------------------------------
-- 1. competitor_listings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  location_text text,
  town text,
  postcode text,
  size_sqft numeric,
  size_min_sqft numeric,
  size_max_sqft numeric,
  price_pence bigint,
  tenure text CHECK (
    tenure IS NULL OR tenure IN ('sale', 'to_let', 'both', 'unknown')
  ),
  competitor_agent text,
  category text NOT NULL DEFAULT 'industrial'
    CHECK (category IN ('industrial', 'retail', 'development')),
  status text NOT NULL DEFAULT 'watching'
    CHECK (status IN ('watching', 'under_offer', 'let_sold', 'withdrawn')),
  source_url text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  price_changed_at timestamptz,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_listings_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS competitor_listings_account_id_idx
  ON public.competitor_listings (account_id);

CREATE INDEX IF NOT EXISTS competitor_listings_account_category_idx
  ON public.competitor_listings (account_id, category)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS competitor_listings_account_status_idx
  ON public.competitor_listings (account_id, status)
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS competitor_listings_account_source_url_uidx
  ON public.competitor_listings (account_id, source_url)
  WHERE source_url IS NOT NULL AND archived_at IS NULL;

COMMENT ON TABLE public.competitor_listings IS
  'Competitor / market-watch properties for commercial Tracker (not own disposals).';

DROP TRIGGER IF EXISTS competitor_listings_set_timestamps
  ON public.competitor_listings;
CREATE TRIGGER competitor_listings_set_timestamps
  BEFORE UPDATE ON public.competitor_listings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- 2. competitor_area_watches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_area_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  towns text[] NOT NULL DEFAULT '{}',
  postcode_prefixes text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT ARRAY['industrial', 'retail', 'development'],
  size_min_sqft numeric,
  size_max_sqft numeric,
  notify_on_new boolean NOT NULL DEFAULT true,
  notify_on_price_change boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_area_watches_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS competitor_area_watches_account_id_idx
  ON public.competitor_area_watches (account_id);

CREATE INDEX IF NOT EXISTS competitor_area_watches_account_enabled_idx
  ON public.competitor_area_watches (account_id)
  WHERE enabled = true;

COMMENT ON TABLE public.competitor_area_watches IS
  'Area watches for Tracker — match ingested competitor rows and notify on new/price change.';

DROP TRIGGER IF EXISTS competitor_area_watches_set_timestamps
  ON public.competitor_area_watches;
CREATE TRIGGER competitor_area_watches_set_timestamps
  BEFORE UPDATE ON public.competitor_area_watches
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- 3. competitor_watch_notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_watch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  watch_id uuid NOT NULL REFERENCES public.competitor_area_watches (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.competitor_listings (id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('new', 'price_changed')),
  summary text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_watch_notifications_watch_listing_event_uidx
    UNIQUE (watch_id, listing_id, event_type)
);

CREATE INDEX IF NOT EXISTS competitor_watch_notifications_account_created_idx
  ON public.competitor_watch_notifications (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS competitor_watch_notifications_account_unread_idx
  ON public.competitor_watch_notifications (account_id)
  WHERE read_at IS NULL;

COMMENT ON TABLE public.competitor_watch_notifications IS
  'In-app notifications when a watch matches a new or price-changed competitor listing.';

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.competitor_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_area_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_watch_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.competitor_listings FROM authenticated, service_role;
REVOKE ALL ON public.competitor_area_watches FROM authenticated, service_role;
REVOKE ALL ON public.competitor_watch_notifications FROM authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_area_watches TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.competitor_watch_notifications TO authenticated;

GRANT ALL ON public.competitor_listings TO service_role;
GRANT ALL ON public.competitor_area_watches TO service_role;
GRANT ALL ON public.competitor_watch_notifications TO service_role;

-- listings
DROP POLICY IF EXISTS competitor_listings_select ON public.competitor_listings;
CREATE POLICY competitor_listings_select ON public.competitor_listings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS competitor_listings_insert ON public.competitor_listings;
CREATE POLICY competitor_listings_insert ON public.competitor_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS competitor_listings_update ON public.competitor_listings;
CREATE POLICY competitor_listings_update ON public.competitor_listings
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS competitor_listings_delete ON public.competitor_listings;
CREATE POLICY competitor_listings_delete ON public.competitor_listings
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
    OR public.has_role_on_account(account_id, 'staff')
    OR public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  );

-- watches
DROP POLICY IF EXISTS competitor_area_watches_select ON public.competitor_area_watches;
CREATE POLICY competitor_area_watches_select ON public.competitor_area_watches
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS competitor_area_watches_insert ON public.competitor_area_watches;
CREATE POLICY competitor_area_watches_insert ON public.competitor_area_watches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS competitor_area_watches_update ON public.competitor_area_watches;
CREATE POLICY competitor_area_watches_update ON public.competitor_area_watches
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS competitor_area_watches_delete ON public.competitor_area_watches;
CREATE POLICY competitor_area_watches_delete ON public.competitor_area_watches
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
    OR public.has_role_on_account(account_id, 'staff')
    OR public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  );

-- notifications (inserts are service_role / cron only)
DROP POLICY IF EXISTS competitor_watch_notifications_select
  ON public.competitor_watch_notifications;
CREATE POLICY competitor_watch_notifications_select
  ON public.competitor_watch_notifications
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS competitor_watch_notifications_insert
  ON public.competitor_watch_notifications;

DROP POLICY IF EXISTS competitor_watch_notifications_update
  ON public.competitor_watch_notifications;
CREATE POLICY competitor_watch_notifications_update
  ON public.competitor_watch_notifications
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS competitor_watch_notifications_delete
  ON public.competitor_watch_notifications;
CREATE POLICY competitor_watch_notifications_delete
  ON public.competitor_watch_notifications
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
    OR public.has_role_on_account(account_id, 'staff')
  );

-- ---------------------------------------------------------------------------
-- 5. Enable Tracker module for commercial-property workspaces
-- ---------------------------------------------------------------------------
INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'tracker', true
FROM public.accounts a
WHERE a.is_personal_account = false
  AND a.space_type = 'commercial-property'
ON CONFLICT (account_id, module_key) DO UPDATE
SET enabled = EXCLUDED.enabled;
