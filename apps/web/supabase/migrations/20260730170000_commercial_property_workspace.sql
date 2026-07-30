-- Commercial Property workspace: first-class space_type + domain tables.
-- Does NOT touch landlord public.properties / property_documents.

-- ---------------------------------------------------------------------------
-- 1. Allow space_type = commercial-property (stored as-is, not remapped)
-- ---------------------------------------------------------------------------
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_space_type_valid;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_space_type_valid CHECK (
  is_personal_account = true
  OR space_type IN ('work', 'family', 'community', 'property', 'commercial-property')
);

COMMENT ON COLUMN public.accounts.space_type IS
  'For non-personal accounts: work, family, community, property (legacy), or commercial-property. NULL when is_personal_account.';

-- ---------------------------------------------------------------------------
-- 2. Permissions
-- New enum labels cannot be used in the same transaction that adds them
-- (SQLSTATE 55P04). Commit via procedure before seeding role_permissions /
-- policies that cast to app_permissions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE public._migration_add_listings_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permissions' AND e.enumlabel = 'listings.view'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'listings.view';
  END IF;
  COMMIT;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permissions' AND e.enumlabel = 'listings.edit'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'listings.edit';
  END IF;
  COMMIT;
END;
$$;

CALL public._migration_add_listings_permissions_enum();
DROP PROCEDURE public._migration_add_listings_permissions_enum();

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'listings.view'::public.app_permissions),
  ('owner', 'listings.edit'::public.app_permissions),
  ('admin', 'listings.view'::public.app_permissions),
  ('admin', 'listings.edit'::public.app_permissions),
  ('staff', 'listings.view'::public.app_permissions),
  ('staff', 'listings.edit'::public.app_permissions)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Domain tables (account-scoped, separate from landlord properties)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  instructing_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  town text,
  postcode text,
  country text DEFAULT 'GB',
  sector text,
  tenure text,
  disposal_type text NOT NULL DEFAULT 'to_let'
    CHECK (disposal_type IN ('to_let', 'for_sale', 'investment')),
  instruction_nature text DEFAULT 'exclusive'
    CHECK (instruction_nature IN ('exclusive', 'joint')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'instructed', 'marketing', 'under_offer', 'let', 'sold', 'withdrawn'
    )),
  asking_rent_pence integer,
  asking_price_pence integer,
  rent_frequency text DEFAULT 'per_annum',
  hide_rent_from_marketing boolean NOT NULL DEFAULT false,
  size_min_sqft numeric,
  size_max_sqft numeric,
  measurement_standard text DEFAULT 'gia',
  use_class text,
  available_from date,
  epc_band text,
  epc_rating integer,
  summary text,
  description text,
  location_copy text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  on_market_at timestamptz,
  off_market_at timestamptz,
  landlord_share_token text UNIQUE,
  landlord_share_enabled boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_listings_account_id_idx
  ON public.commercial_listings (account_id);
CREATE INDEX IF NOT EXISTS commercial_listings_status_idx
  ON public.commercial_listings (account_id, status);
CREATE INDEX IF NOT EXISTS commercial_listings_landlord_share_token_idx
  ON public.commercial_listings (landlord_share_token)
  WHERE landlord_share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commercial_listing_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  label text NOT NULL,
  floor_or_unit text,
  size_sqft numeric,
  measurement_standard text DEFAULT 'gia',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_listing_units_listing_id_idx
  ON public.commercial_listing_units (listing_id);

CREATE TABLE IF NOT EXISTS public.commercial_listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'image'
    CHECK (media_type IN (
      'image', 'brochure', 'floorplan', 'epc', 'video', 'other'
    )),
  storage_path text,
  external_url text,
  file_name text,
  mime_type text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_listing_media_listing_id_idx
  ON public.commercial_listing_media (listing_id);

CREATE TABLE IF NOT EXISTS public.commercial_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  company_name text,
  sector text,
  tenure text CHECK (tenure IS NULL OR tenure IN ('rent', 'buy', 'both')),
  location_text text,
  size_min_sqft numeric,
  size_max_sqft numeric,
  budget_min_pence integer,
  budget_max_pence integer,
  stage text NOT NULL DEFAULT 'unactioned'
    CHECK (stage IN (
      'unactioned', 'prospect', 'search', 'viewing', 'negotiating',
      'under_offer', 'success', 'ongoing', 'on_hold', 'unsuccessful'
    )),
  assigned_to uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text,
  source text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_requirements_account_id_idx
  ON public.commercial_requirements (account_id);
CREATE INDEX IF NOT EXISTS commercial_requirements_stage_idx
  ON public.commercial_requirements (account_id, stage);

CREATE TABLE IF NOT EXISTS public.commercial_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.commercial_requirements (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'shortlisted'
    CHECK (status IN (
      'shortlisted', 'enquiry', 'viewing', 'negotiating',
      'under_offer', 'signed', 'idle', 'discounted'
    )),
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS commercial_matches_listing_id_idx
  ON public.commercial_matches (listing_id);

CREATE TABLE IF NOT EXISTS public.commercial_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.commercial_listings (id) ON DELETE SET NULL,
  requirement_id uuid REFERENCES public.commercial_requirements (id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.commercial_matches (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual', 'website', 'rightmove', 'each', 'other'
    )),
  status text NOT NULL DEFAULT 'unactioned'
    CHECK (status IN ('unactioned', 'on_schedule', 'archived')),
  contact_name text,
  contact_email text,
  contact_phone text,
  message text,
  target_size_min_sqft numeric,
  target_size_max_sqft numeric,
  property_types text,
  areas_text text,
  tenure text,
  external_ref text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_enquiries_account_id_idx
  ON public.commercial_enquiries (account_id);
CREATE INDEX IF NOT EXISTS commercial_enquiries_listing_id_idx
  ON public.commercial_enquiries (listing_id);

CREATE TABLE IF NOT EXISTS public.commercial_viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  enquiry_id uuid REFERENCES public.commercial_enquiries (id) ON DELETE SET NULL,
  requirement_id uuid REFERENCES public.commercial_requirements (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  conducted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  outcome text,
  feedback text,
  status text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'completed', 'cancelled', 'awaiting_feedback')),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_viewings_account_id_idx
  ON public.commercial_viewings (account_id);
CREATE INDEX IF NOT EXISTS commercial_viewings_listing_id_idx
  ON public.commercial_viewings (listing_id);

CREATE TABLE IF NOT EXISTS public.commercial_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.commercial_listings (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  property_label text NOT NULL,
  town text,
  postcode text,
  tenant_name text,
  headline_rent_psf numeric,
  lease_start date,
  lease_end date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'terminated')),
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_leases_account_id_idx
  ON public.commercial_leases (account_id);

CREATE TABLE IF NOT EXISTS public.commercial_portal_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  portal text NOT NULL
    CHECK (portal IN ('property_hive', 'rightmove', 'each', 'other')),
  external_id text,
  external_url text,
  branch_ref text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'unpublished', 'error')),
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, portal)
);

CREATE INDEX IF NOT EXISTS commercial_portal_publications_account_id_idx
  ON public.commercial_portal_publications (account_id);

CREATE TABLE IF NOT EXISTS public.commercial_portal_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  portal text NOT NULL
    CHECK (portal IN ('property_hive', 'rightmove', 'each')),
  site_url text,
  username text,
  -- Encrypted / app-managed secret blob (never log)
  secret_ciphertext text,
  office_id text,
  branch_id text,
  network_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, portal)
);

-- Pipeline deal FKs to commercial entities
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS commercial_listing_id uuid
    REFERENCES public.commercial_listings (id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS commercial_requirement_id uuid
    REFERENCES public.commercial_requirements (id) ON DELETE SET NULL;

-- Optional commercial role tag on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS commercial_role text
    CHECK (
      commercial_role IS NULL
      OR commercial_role IN (
        'landlord', 'tenant', 'investor', 'solicitor', 'agent', 'other'
      )
    );

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_listing_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_portal_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_portal_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_listings FROM authenticated, service_role;
REVOKE ALL ON public.commercial_listing_units FROM authenticated, service_role;
REVOKE ALL ON public.commercial_listing_media FROM authenticated, service_role;
REVOKE ALL ON public.commercial_requirements FROM authenticated, service_role;
REVOKE ALL ON public.commercial_matches FROM authenticated, service_role;
REVOKE ALL ON public.commercial_enquiries FROM authenticated, service_role;
REVOKE ALL ON public.commercial_viewings FROM authenticated, service_role;
REVOKE ALL ON public.commercial_leases FROM authenticated, service_role;
REVOKE ALL ON public.commercial_portal_publications FROM authenticated, service_role;
REVOKE ALL ON public.commercial_portal_credentials FROM authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_enquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_viewings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_leases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_portal_publications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_portal_credentials TO authenticated;

GRANT ALL ON public.commercial_listings TO service_role;
GRANT ALL ON public.commercial_listing_units TO service_role;
GRANT ALL ON public.commercial_listing_media TO service_role;
GRANT ALL ON public.commercial_requirements TO service_role;
GRANT ALL ON public.commercial_matches TO service_role;
GRANT ALL ON public.commercial_enquiries TO service_role;
GRANT ALL ON public.commercial_viewings TO service_role;
GRANT ALL ON public.commercial_leases TO service_role;
GRANT ALL ON public.commercial_portal_publications TO service_role;
GRANT ALL ON public.commercial_portal_credentials TO service_role;

-- Helper predicate reused in policies
-- Member can read; listings.edit (or owner/admin/staff) can write

CREATE POLICY commercial_listings_select ON public.commercial_listings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE POLICY commercial_listings_insert ON public.commercial_listings
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

CREATE POLICY commercial_listings_update ON public.commercial_listings
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
  );

CREATE POLICY commercial_listings_delete ON public.commercial_listings
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
  );

-- Child tables: same membership pattern
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'commercial_listing_units',
    'commercial_listing_media',
    'commercial_requirements',
    'commercial_matches',
    'commercial_enquiries',
    'commercial_viewings',
    'commercial_leases',
    'commercial_portal_publications',
    'commercial_portal_credentials'
  ]
  LOOP
    EXECUTE format($p$
      CREATE POLICY %1$I_select ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.has_role_on_account(account_id));
      CREATE POLICY %1$I_insert ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role_on_account(account_id));
      CREATE POLICY %1$I_update ON public.%1$I
        FOR UPDATE TO authenticated
        USING (public.has_role_on_account(account_id))
        WITH CHECK (public.has_role_on_account(account_id));
      CREATE POLICY %1$I_delete ON public.%1$I
        FOR DELETE TO authenticated
        USING (
          public.has_role_on_account(account_id, 'owner')
          OR public.has_role_on_account(account_id, 'admin')
          OR public.has_role_on_account(account_id, 'staff')
        );
    $p$, t);
  END LOOP;
END $$;

-- Public landlord share: anon/authenticated can read listing + matches by token
CREATE POLICY commercial_listings_landlord_share_public ON public.commercial_listings
  FOR SELECT TO anon, authenticated
  USING (
    landlord_share_enabled = true
    AND landlord_share_token IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for commercial listing media
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('commercial-listing-media', 'commercial-listing-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY commercial_listing_media_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'commercial-listing-media'
    AND public.has_role_on_account((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY commercial_listing_media_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-listing-media'
    AND public.has_role_on_account((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY commercial_listing_media_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'commercial-listing-media'
    AND public.has_role_on_account((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY commercial_listing_media_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'commercial-listing-media'
    AND public.has_role_on_account((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- 6. create_team_account — accept commercial-property, store as-is
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work',
  account_business_type text DEFAULT 'other',
  account_complete_onboarding boolean DEFAULT false
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_account public.accounts;
  owner_role varchar(50);
  normalized_space_type text;
  normalized_business_type text;
  store_space_type text;
  business_slug text;
  has_business_slug boolean;
  membership_onboarding_completed boolean;
  seed_business_type text;
BEGIN
  IF NOT public.is_set('enable_team_accounts') THEN
    RAISE EXCEPTION 'Team accounts are not enabled';
  END IF;

  membership_onboarding_completed := COALESCE(account_complete_onboarding, false);

  normalized_space_type := lower(coalesce(account_space_type, 'work'));
  normalized_business_type := lower(coalesce(account_business_type, 'other'));

  IF normalized_space_type NOT IN (
    'work', 'family', 'community', 'property', 'commercial-property'
  ) THEN
    RAISE EXCEPTION
      'Invalid account_space_type. Expected work, family, community, property, or commercial-property.';
  END IF;

  IF normalized_business_type NOT IN ('design', 'property', 'other', 'lite') THEN
    RAISE EXCEPTION 'Invalid account_business_type. Expected design, property, other, or lite.';
  END IF;

  -- Landlord property remaps to work; commercial-property is first-class
  IF normalized_space_type IN ('work', 'property') THEN
    store_space_type := 'work';
  ELSE
    store_space_type := normalized_space_type;
  END IF;

  seed_business_type := CASE
    WHEN normalized_business_type = 'lite' THEN 'lite'
    WHEN normalized_space_type = 'property' OR normalized_business_type = 'property' THEN 'property'
    WHEN normalized_business_type = 'design' THEN 'design'
    ELSE 'other'
  END;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'slug'
  ) INTO has_business_slug;

  SELECT public.get_upper_system_role() INTO owner_role;

  INSERT INTO public.accounts (
    name,
    slug,
    is_personal_account,
    primary_owner_user_id,
    space_type
  )
  VALUES (
    account_name,
    account_slug,
    false,
    user_id,
    store_space_type
  )
  RETURNING * INTO new_account;

  INSERT INTO public.accounts_memberships (
    account_id,
    user_id,
    account_role,
    company_role,
    onboarding_step,
    onboarding_completed
  )
  VALUES (
    new_account.id,
    user_id,
    COALESCE(owner_role, 'owner'),
    'admin',
    1,
    membership_onboarding_completed
  );

  PERFORM public.seed_account_module_settings(
    new_account.id,
    store_space_type,
    seed_business_type
  );

  IF store_space_type = 'work' AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.account_id = new_account.id
    ) THEN
      business_slug := COALESCE(
        nullif(trim(account_slug), ''),
        lower(regexp_replace(account_name, '[^a-zA-Z0-9]+', '-', 'g'))
      );

      IF has_business_slug THEN
        INSERT INTO public.businesses (account_id, name, type, slug, owner_id)
        VALUES (
          new_account.id,
          account_name,
          seed_business_type,
          business_slug,
          user_id
        );
      ELSE
        INSERT INTO public.businesses (account_id, name, type, owner_id)
        VALUES (
          new_account.id,
          account_name,
          seed_business_type,
          user_id
        );
      END IF;
    END IF;
  END IF;

  IF store_space_type IN ('family', 'community') THEN
    INSERT INTO public.groups (account_id, name, kind)
    SELECT new_account.id, account_name,
      CASE WHEN store_space_type = 'family' THEN 'family' ELSE 'community' END
    WHERE EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'groups'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.groups g WHERE g.account_id = new_account.id
    );
  END IF;

  RETURN new_account;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. seed_account_module_settings — commercial-property branch
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
      'dashboard', 'tasks', 'calendar', 'meal_plan', 'shopping',
      'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'commercial-property' THEN
    keys := ARRAY[
      'dashboard', 'listings', 'pipeline', 'clients', 'requirements',
      'viewings', 'proposals', 'leases', 'reports', 'docs', 'tasks',
      'notes', 'team', 'settings'
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
