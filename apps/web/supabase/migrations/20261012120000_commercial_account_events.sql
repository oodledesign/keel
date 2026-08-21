-- Account-wide commercial audit log (disposals, contacts, and future entity types).

CREATE TABLE IF NOT EXISTS public.commercial_account_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_account_events_entity_type_check
    CHECK (entity_type IN ('listing', 'client', 'requirement', 'viewing', 'other'))
);

CREATE INDEX IF NOT EXISTS commercial_account_events_account_created_idx
  ON public.commercial_account_events (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commercial_account_events_account_entity_created_idx
  ON public.commercial_account_events (account_id, entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS commercial_account_events_entity_idx
  ON public.commercial_account_events (entity_type, entity_id, created_at DESC);

COMMENT ON TABLE public.commercial_account_events IS
  'Append-only workspace audit feed for commercial entities (disposals, contacts, etc.).';

ALTER TABLE public.commercial_account_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_account_events FROM authenticated, service_role;
GRANT SELECT, INSERT ON public.commercial_account_events TO authenticated;
GRANT ALL ON public.commercial_account_events TO service_role;

DROP POLICY IF EXISTS commercial_account_events_select
  ON public.commercial_account_events;
CREATE POLICY commercial_account_events_select
  ON public.commercial_account_events
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_account_events_insert
  ON public.commercial_account_events;
CREATE POLICY commercial_account_events_insert
  ON public.commercial_account_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
