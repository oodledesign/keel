-- Co-marketing / joint agents on commercial disposals.
-- Links a workspace client (agency firm or agent contact) to a listing.

CREATE TABLE IF NOT EXISTS public.commercial_listing_co_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  contact_name text,
  contact_email text,
  contact_phone text,
  external_id text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_listing_co_agents_listing_client_uidx UNIQUE (listing_id, client_id)
);

CREATE INDEX IF NOT EXISTS commercial_listing_co_agents_listing_id_idx
  ON public.commercial_listing_co_agents (listing_id);

CREATE INDEX IF NOT EXISTS commercial_listing_co_agents_account_id_idx
  ON public.commercial_listing_co_agents (account_id);

CREATE INDEX IF NOT EXISTS commercial_listing_co_agents_client_id_idx
  ON public.commercial_listing_co_agents (client_id);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_listing_co_agents_external_uidx
  ON public.commercial_listing_co_agents (account_id, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON TABLE public.commercial_listing_co_agents IS
  'External / joint agents co-marketing a commercial disposal (workspace clients).';

-- Keep client + listing in the same account
CREATE OR REPLACE FUNCTION public.commercial_listing_co_agents_account_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_account uuid;
  client_account uuid;
BEGIN
  SELECT account_id INTO listing_account
  FROM public.commercial_listings
  WHERE id = NEW.listing_id;

  SELECT account_id INTO client_account
  FROM public.clients
  WHERE id = NEW.client_id;

  IF listing_account IS NULL OR client_account IS NULL THEN
    RAISE EXCEPTION 'co-agent listing or client not found';
  END IF;

  IF listing_account <> NEW.account_id OR client_account <> NEW.account_id THEN
    RAISE EXCEPTION 'co-agent listing, client, and account_id must match';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_listing_co_agents_account_guard_trg
  ON public.commercial_listing_co_agents;
CREATE TRIGGER commercial_listing_co_agents_account_guard_trg
  BEFORE INSERT OR UPDATE ON public.commercial_listing_co_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.commercial_listing_co_agents_account_guard();

ALTER TABLE public.commercial_listing_co_agents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_listing_co_agents FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_co_agents TO authenticated;
GRANT ALL ON public.commercial_listing_co_agents TO service_role;

DROP POLICY IF EXISTS commercial_listing_co_agents_select ON public.commercial_listing_co_agents;
CREATE POLICY commercial_listing_co_agents_select ON public.commercial_listing_co_agents
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_co_agents_insert ON public.commercial_listing_co_agents;
CREATE POLICY commercial_listing_co_agents_insert ON public.commercial_listing_co_agents
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

DROP POLICY IF EXISTS commercial_listing_co_agents_update ON public.commercial_listing_co_agents;
CREATE POLICY commercial_listing_co_agents_update ON public.commercial_listing_co_agents
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

DROP POLICY IF EXISTS commercial_listing_co_agents_delete ON public.commercial_listing_co_agents;
CREATE POLICY commercial_listing_co_agents_delete ON public.commercial_listing_co_agents
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );
