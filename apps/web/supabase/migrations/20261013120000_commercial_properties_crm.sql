-- Commercial CRM properties (assets independent of disposals) + richer party roles.

-- ---------------------------------------------------------------------------
-- 1. commercial_properties
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  town text,
  postcode text,
  country text DEFAULT 'GB',
  latitude numeric,
  longitude numeric,
  sector text,
  notes text,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_properties_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS commercial_properties_account_id_idx
  ON public.commercial_properties (account_id);

CREATE INDEX IF NOT EXISTS commercial_properties_account_postcode_idx
  ON public.commercial_properties (account_id, postcode);

CREATE INDEX IF NOT EXISTS commercial_properties_account_archived_idx
  ON public.commercial_properties (account_id)
  WHERE archived_at IS NULL;

COMMENT ON TABLE public.commercial_properties IS
  'Commercial agency property assets (may exist without a disposal/instruction).';

-- ---------------------------------------------------------------------------
-- 2. commercial_property_parties
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_property_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.commercial_properties (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  role text NOT NULL CHECK (
    role IN (
      'landlord',
      'landlord_representative',
      'tenant',
      'managing_agent',
      'solicitor',
      'other'
    )
  ),
  contact_name text,
  contact_email text,
  contact_phone text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_property_parties_property_client_role_uidx
    UNIQUE (property_id, client_id, role)
);

CREATE INDEX IF NOT EXISTS commercial_property_parties_property_id_idx
  ON public.commercial_property_parties (property_id);
CREATE INDEX IF NOT EXISTS commercial_property_parties_account_id_idx
  ON public.commercial_property_parties (account_id);
CREATE INDEX IF NOT EXISTS commercial_property_parties_client_id_idx
  ON public.commercial_property_parties (client_id);
CREATE INDEX IF NOT EXISTS commercial_property_parties_contact_id_idx
  ON public.commercial_property_parties (contact_id)
  WHERE contact_id IS NOT NULL;

COMMENT ON TABLE public.commercial_property_parties IS
  'Contacts/people linked to a commercial property asset with a role.';

CREATE OR REPLACE FUNCTION public.commercial_property_parties_account_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  property_account uuid;
  client_account uuid;
  contact_account uuid;
BEGIN
  SELECT account_id INTO property_account
  FROM public.commercial_properties
  WHERE id = NEW.property_id;

  SELECT account_id INTO client_account
  FROM public.clients
  WHERE id = NEW.client_id;

  IF property_account IS NULL OR client_account IS NULL THEN
    RAISE EXCEPTION 'property party property or client not found';
  END IF;

  IF property_account <> NEW.account_id OR client_account <> NEW.account_id THEN
    RAISE EXCEPTION 'property party property, client, and account_id must match';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO contact_account
    FROM public.contacts
    WHERE id = NEW.contact_id;

    IF contact_account IS NULL OR contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'property party contact must belong to the same account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_property_parties_account_guard_trg
  ON public.commercial_property_parties;
CREATE TRIGGER commercial_property_parties_account_guard_trg
  BEFORE INSERT OR UPDATE ON public.commercial_property_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.commercial_property_parties_account_guard();

-- ---------------------------------------------------------------------------
-- 3. Link disposals → properties; widen listing party roles + contact_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS commercial_property_id uuid
    REFERENCES public.commercial_properties (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_listings_commercial_property_id_idx
  ON public.commercial_listings (commercial_property_id)
  WHERE commercial_property_id IS NOT NULL;

COMMENT ON COLUMN public.commercial_listings.commercial_property_id IS
  'Optional CRM property asset this disposal markets.';

ALTER TABLE public.commercial_listing_parties
  ADD COLUMN IF NOT EXISTS contact_id uuid
    REFERENCES public.contacts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_listing_parties_contact_id_idx
  ON public.commercial_listing_parties (contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.commercial_listing_parties
  DROP CONSTRAINT IF EXISTS commercial_listing_parties_role_check;

ALTER TABLE public.commercial_listing_parties
  ADD CONSTRAINT commercial_listing_parties_role_check
  CHECK (
    role IN (
      'landlord',
      'landlord_representative',
      'tenant',
      'managing_agent',
      'solicitor',
      'other'
    )
  );

CREATE OR REPLACE FUNCTION public.commercial_listing_parties_account_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_account uuid;
  client_account uuid;
  contact_account uuid;
BEGIN
  SELECT account_id INTO listing_account
  FROM public.commercial_listings
  WHERE id = NEW.listing_id;

  SELECT account_id INTO client_account
  FROM public.clients
  WHERE id = NEW.client_id;

  IF listing_account IS NULL OR client_account IS NULL THEN
    RAISE EXCEPTION 'listing party listing or client not found';
  END IF;

  IF listing_account <> NEW.account_id OR client_account <> NEW.account_id THEN
    RAISE EXCEPTION 'listing party listing, client, and account_id must match';
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT account_id INTO contact_account
    FROM public.contacts
    WHERE id = NEW.contact_id;

    IF contact_account IS NULL OR contact_account <> NEW.account_id THEN
      RAISE EXCEPTION 'listing party contact must belong to the same account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_listing_parties_account_guard_trg
  ON public.commercial_listing_parties;
CREATE TRIGGER commercial_listing_parties_account_guard_trg
  BEFORE INSERT OR UPDATE ON public.commercial_listing_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.commercial_listing_parties_account_guard();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_property_parties ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_properties FROM authenticated, service_role;
REVOKE ALL ON public.commercial_property_parties FROM authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_property_parties TO authenticated;

GRANT ALL ON public.commercial_properties TO service_role;
GRANT ALL ON public.commercial_property_parties TO service_role;

DROP POLICY IF EXISTS commercial_properties_select ON public.commercial_properties;
CREATE POLICY commercial_properties_select ON public.commercial_properties
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_properties_insert ON public.commercial_properties;
CREATE POLICY commercial_properties_insert ON public.commercial_properties
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

DROP POLICY IF EXISTS commercial_properties_update ON public.commercial_properties;
CREATE POLICY commercial_properties_update ON public.commercial_properties
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

DROP POLICY IF EXISTS commercial_properties_delete ON public.commercial_properties;
CREATE POLICY commercial_properties_delete ON public.commercial_properties
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
    OR public.has_role_on_account(account_id, 'staff')
    OR public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS commercial_property_parties_select ON public.commercial_property_parties;
CREATE POLICY commercial_property_parties_select ON public.commercial_property_parties
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_property_parties_insert ON public.commercial_property_parties;
CREATE POLICY commercial_property_parties_insert ON public.commercial_property_parties
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

DROP POLICY IF EXISTS commercial_property_parties_update ON public.commercial_property_parties;
CREATE POLICY commercial_property_parties_update ON public.commercial_property_parties
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

DROP POLICY IF EXISTS commercial_property_parties_delete ON public.commercial_property_parties;
CREATE POLICY commercial_property_parties_delete ON public.commercial_property_parties
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

-- ---------------------------------------------------------------------------
-- 5. Enable properties module for commercial workspaces
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text DEFAULT 'work',
  p_business_type text DEFAULT 'other'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_space text;
  normalized_biz text;
  keys text[];
  k text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'jobs', 'calendar', 'meal_plan', 'shopping',
      'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'commercial-property' THEN
    keys := ARRAY[
      'dashboard', 'listings', 'pipeline', 'clients', 'properties',
      'requirements', 'viewings', 'proposals', 'leases', 'reports', 'docs',
      'tasks', 'notes', 'sops', 'team', 'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys
  LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'properties', true
FROM public.accounts a
WHERE a.is_personal_account = false
  AND a.space_type = 'commercial-property'
ON CONFLICT (account_id, module_key) DO NOTHING;
