-- Workspace type system: businesses.type, module seeding on account creation, groups for family/community.

-- 1) businesses.type (design | property | other) for work accounts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'other';

    ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_valid;
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_valid CHECK (
      type IN ('design', 'property', 'other')
    );

    COMMENT ON COLUMN public.businesses.type IS
      'Business segment for work accounts: design studio, property portfolio, or other.';
  END IF;
END $$;

-- 2) Optional groups row per family/community workspace
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill columns on pre-existing groups tables (drift from ad-hoc migrations)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Group',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_account_id_fkey'
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_account_id_key'
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_account_id_key UNIQUE (account_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_groups_account_id ON public.groups(account_id);

COMMENT ON TABLE public.groups IS
  'One group record per family/community workspace account.';

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated, service_role;

DROP POLICY IF EXISTS groups_select ON public.groups;
CREATE POLICY groups_select ON public.groups
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS groups_mutate ON public.groups;
CREATE POLICY groups_mutate ON public.groups
  FOR ALL TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

-- 3) Seed account_module_settings for a workspace profile
CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text,
  p_business_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  keys text[];
  k text;
  normalized_space text;
  normalized_biz text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'calendar', 'meal_plan', 'shopping',
      'notes', 'team', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'invoices', 'team', 'notes', 'docs', 'finances', 'apps',
      'feedflow', 'rankly', 'signatures', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_account_module_settings(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_account_module_settings(uuid, text, text) TO service_role;

-- 4) create_team_account: seed modules; optional business_type for work
CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work',
  account_business_type text DEFAULT NULL
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
BEGIN
  IF NOT public.is_set('enable_team_accounts') THEN
    RAISE EXCEPTION 'Team accounts are not enabled';
  END IF;

  normalized_space_type := lower(coalesce(account_space_type, 'work'));
  normalized_business_type := lower(coalesce(account_business_type, 'other'));

  IF normalized_space_type NOT IN ('work', 'family', 'community', 'property') THEN
    RAISE EXCEPTION 'Invalid account_space_type. Expected work, family, community, or property.';
  END IF;

  IF normalized_business_type NOT IN ('design', 'property', 'other') THEN
    RAISE EXCEPTION 'Invalid account_business_type. Expected design, property, or other.';
  END IF;

  -- Store work for business workspaces; property segment lives on businesses.type
  IF normalized_space_type IN ('work', 'property') THEN
    store_space_type := 'work';
  ELSE
    store_space_type := normalized_space_type;
  END IF;

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
    false
  );

  PERFORM public.seed_account_module_settings(
    new_account.id,
    store_space_type,
    CASE
      WHEN normalized_space_type = 'property' OR normalized_business_type = 'property'
        THEN 'property'
      WHEN normalized_business_type = 'design' THEN 'design'
      ELSE 'other'
    END
  );

  IF store_space_type = 'work' AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.account_id = new_account.id
    ) THEN
      business_slug := COALESCE(
        NULLIF(trim(new_account.slug), ''),
        kit.slugify(account_name)
      );

      IF has_business_slug THEN
        IF EXISTS (
          SELECT 1 FROM public.businesses b WHERE b.slug = business_slug
        ) THEN
          business_slug := business_slug || '-' || substring(
            replace(gen_random_uuid()::text, '-', ''),
            1,
            8
          );
        END IF;

        INSERT INTO public.businesses (name, account_id, type, slug)
        VALUES (
          account_name,
          new_account.id,
          CASE
            WHEN normalized_space_type = 'property' OR normalized_business_type = 'property'
              THEN 'property'
            WHEN normalized_business_type = 'design' THEN 'design'
            ELSE 'other'
          END,
          business_slug
        );
      ELSE
        INSERT INTO public.businesses (name, account_id, type)
        VALUES (
          account_name,
          new_account.id,
          CASE
            WHEN normalized_space_type = 'property' OR normalized_business_type = 'property'
              THEN 'property'
            WHEN normalized_business_type = 'design' THEN 'design'
            ELSE 'other'
          END
        );
      END IF;
    END IF;
  END IF;

  IF store_space_type IN ('family', 'community') THEN
    INSERT INTO public.groups (account_id, name)
    VALUES (new_account.id, account_name)
    ON CONFLICT (account_id) DO NOTHING;
  END IF;

  RETURN new_account;
END;
$$;

-- Backward-compatible 4-arg overload
CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work'
)
RETURNS public.accounts
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.create_team_account(
    account_name,
    user_id,
    account_slug,
    account_space_type,
    NULL::text
  );
$$;

REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text, text) FROM public, authenticated;
REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text) TO service_role;

-- Backfill module settings for team accounts missing rows
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT a.id, a.space_type
    FROM public.accounts a
    WHERE a.is_personal_account = false
      AND NOT EXISTS (
        SELECT 1 FROM public.account_module_settings s WHERE s.account_id = a.id
      )
  LOOP
    PERFORM public.seed_account_module_settings(r.id, r.space_type, NULL);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
