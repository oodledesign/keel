-- Business Lite (free apps shell) + Signatures as a paid add-on (not bundled in full business seed).

-- 0) Allow onboard/backfill entitlement sources used by Business Lite
ALTER TABLE public.account_entitlements
  DROP CONSTRAINT IF EXISTS account_entitlements_source_check;

ALTER TABLE public.account_entitlements
  ADD CONSTRAINT account_entitlements_source_check
  CHECK (source IN (
    'stripe',
    'admin_grant',
    'trial',
    'super_admin',
    'onboard',
    'backfill'
  ));

-- 1) businesses.type: allow 'lite'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_valid;
    ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_check;

    ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_valid CHECK (
      type IN ('design', 'property', 'other', 'lite')
    );

    COMMENT ON COLUMN public.businesses.type IS
      'Business segment: design studio, property, lite (apps-only shell), or other.';
  END IF;
END $$;

-- 2) Module seed: lite shell vs full business (add-ons enabled via entitlements only)
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
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

-- 3) create_team_account: accept business_type 'lite' and grant free lite entitlement
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
  seed_business_type text;
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

  IF normalized_business_type NOT IN ('design', 'property', 'other', 'lite') THEN
    RAISE EXCEPTION 'Invalid account_business_type. Expected design, property, other, or lite.';
  END IF;

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
          seed_business_type,
          business_slug
        );
      ELSE
        INSERT INTO public.businesses (name, account_id, type)
        VALUES (
          account_name,
          new_account.id,
          seed_business_type
        );
      END IF;
    END IF;
  END IF;

  IF normalized_business_type = 'lite' THEN
    INSERT INTO public.account_entitlements (
      account_id,
      entitlement_key,
      source,
      updated_at
    )
    VALUES (
      new_account.id,
      'workspace_business_lite',
      'onboard',
      now()
    )
    ON CONFLICT (account_id, entitlement_key) DO NOTHING;

    INSERT INTO public.account_plan_limits (
      account_id,
      plan_product_id,
      plan_id,
      plan_family,
      max_members,
      updated_at
    )
    VALUES (
      new_account.id,
      'keel-business-lite',
      'business-lite-free',
      'business_lite',
      3,
      now()
    )
    ON CONFLICT (account_id) DO UPDATE SET
      plan_product_id = EXCLUDED.plan_product_id,
      plan_id = EXCLUDED.plan_id,
      plan_family = EXCLUDED.plan_family,
      max_members = EXCLUDED.max_members,
      updated_at = EXCLUDED.updated_at;
  END IF;

  IF store_space_type IN ('family', 'community') THEN
    INSERT INTO public.groups (account_id, name)
    VALUES (new_account.id, account_name)
    ON CONFLICT (account_id) DO NOTHING;
  END IF;

  RETURN new_account;
END;
$$;

-- 4) Backfill: disable bundled add-on modules unless entitlement exists
UPDATE public.account_module_settings ams
SET enabled = false
WHERE ams.module_key IN ('signatures', 'rankly', 'feedflow', 'videos')
  AND NOT EXISTS (
    SELECT 1
    FROM public.account_entitlements ae
    WHERE ae.account_id = ams.account_id
      AND (
        (ams.module_key = 'signatures' AND ae.entitlement_key = 'addon_signatures')
        OR (ams.module_key = 'rankly' AND ae.entitlement_key = 'addon_rankly')
        OR (ams.module_key = 'feedflow' AND ae.entitlement_key = 'addon_feedflow')
        OR (ams.module_key = 'videos' AND ae.entitlement_key = 'addon_videos')
      )
      AND (ae.expires_at IS NULL OR ae.expires_at > now())
  );

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT ae.account_id, 'signatures', true
FROM public.account_entitlements ae
WHERE ae.entitlement_key = 'addon_signatures'
  AND (ae.expires_at IS NULL OR ae.expires_at > now())
ON CONFLICT (account_id, module_key) DO UPDATE SET enabled = true;

-- 5) Grant lite to existing unpaid work workspaces (no full business entitlement/subscription)
INSERT INTO public.account_entitlements (account_id, entitlement_key, source, updated_at)
SELECT a.id, 'workspace_business_lite', 'backfill', now()
FROM public.accounts a
WHERE a.is_personal_account = false
  AND coalesce(a.space_type, 'work') = 'work'
  AND NOT EXISTS (
    SELECT 1 FROM public.account_entitlements ae
    WHERE ae.account_id = a.id
      AND ae.entitlement_key IN ('workspace_business', 'workspace_business_lite')
      AND (ae.expires_at IS NULL OR ae.expires_at > now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.account_id = a.id
      AND s.status IN ('active', 'trialing')
  )
ON CONFLICT (account_id, entitlement_key) DO NOTHING;

INSERT INTO public.account_plan_limits (account_id, plan_product_id, plan_id, plan_family, max_members, updated_at)
SELECT a.id, 'keel-business-lite', 'business-lite-free', 'business_lite', 3, now()
FROM public.accounts a
WHERE a.is_personal_account = false
  AND coalesce(a.space_type, 'work') = 'work'
  AND EXISTS (
    SELECT 1 FROM public.account_entitlements ae
    WHERE ae.account_id = a.id
      AND ae.entitlement_key = 'workspace_business_lite'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.account_plan_limits apl
    WHERE apl.account_id = a.id
      AND apl.plan_family = 'business'
  )
ON CONFLICT (account_id) DO NOTHING;

UPDATE public.businesses b
SET type = 'lite'
WHERE b.type = 'other'
  AND EXISTS (
    SELECT 1 FROM public.account_entitlements ae
    WHERE ae.account_id = b.account_id
      AND ae.entitlement_key = 'workspace_business_lite'
      AND (ae.expires_at IS NULL OR ae.expires_at > now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.account_entitlements ae
    WHERE ae.account_id = b.account_id
      AND ae.entitlement_key = 'workspace_business'
      AND (ae.expires_at IS NULL OR ae.expires_at > now())
  );

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT DISTINCT account_id, 'apps', true
FROM public.account_entitlements
WHERE entitlement_key IN (
  'addon_signatures',
  'addon_rankly',
  'addon_feedflow',
  'addon_videos'
)
  AND (expires_at IS NULL OR expires_at > now())
ON CONFLICT (account_id, module_key) DO UPDATE SET enabled = true;
