-- Remote DB still has legacy kit.prevent_memberships_update (account_role only).
-- Workspace setup updates onboarding_completed and must be allowed.

CREATE OR REPLACE FUNCTION kit.prevent_memberships_update()
RETURNS trigger
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.account_role IS DISTINCT FROM old.account_role
     OR new.company_role IS DISTINCT FROM old.company_role
     OR new.trade_role IS DISTINCT FROM old.trade_role
     OR new.onboarding_step IS DISTINCT FROM old.onboarding_step
     OR new.onboarding_completed IS DISTINCT FROM old.onboarding_completed THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION
    'Only account_role, company_role, trade_role, onboarding_step, and onboarding_completed can be updated';
END;
$$;

-- create_team_account: optional flag to mark workspace setup complete on insert
CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work',
  account_business_type text DEFAULT NULL,
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
BEGIN
  IF NOT public.is_set('enable_team_accounts') THEN
    RAISE EXCEPTION 'Team accounts are not enabled';
  END IF;

  membership_onboarding_completed := COALESCE(account_complete_onboarding, false);

  normalized_space_type := lower(coalesce(account_space_type, 'work'));
  normalized_business_type := lower(coalesce(account_business_type, 'other'));

  IF normalized_space_type NOT IN ('work', 'family', 'community', 'property') THEN
    RAISE EXCEPTION 'Invalid account_space_type. Expected work, family, community, or property.';
  END IF;

  IF normalized_business_type NOT IN ('design', 'property', 'other') THEN
    RAISE EXCEPTION 'Invalid account_business_type. Expected design, property, or other.';
  END IF;

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
    membership_onboarding_completed
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

CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work',
  account_business_type text DEFAULT NULL
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
    account_business_type,
    false
  );
$$;

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
    NULL::text,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text, text, boolean) FROM public, authenticated;
REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text, text) FROM public, authenticated;
REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
