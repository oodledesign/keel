-- Activity timeline events per commercial disposal (listing).

CREATE TABLE IF NOT EXISTS public.commercial_listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_listing_events_listing_created_idx
  ON public.commercial_listing_events (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commercial_listing_events_account_id_idx
  ON public.commercial_listing_events (account_id);

-- At most one seed claim per listing (prevents double-seed races).
CREATE UNIQUE INDEX IF NOT EXISTS commercial_listing_events_seed_claim_uidx
  ON public.commercial_listing_events (listing_id)
  WHERE event_type = 'seeded';

COMMENT ON TABLE public.commercial_listing_events IS
  'Append-only activity feed for commercial disposals (status, matches, viewings, portals, etc.).';

ALTER TABLE public.commercial_listing_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_listing_events FROM authenticated, service_role;
GRANT SELECT, INSERT ON public.commercial_listing_events TO authenticated;
GRANT ALL ON public.commercial_listing_events TO service_role;

DROP POLICY IF EXISTS commercial_listing_events_select
  ON public.commercial_listing_events;
CREATE POLICY commercial_listing_events_select
  ON public.commercial_listing_events
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_events_insert
  ON public.commercial_listing_events;
CREATE POLICY commercial_listing_events_insert
  ON public.commercial_listing_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
