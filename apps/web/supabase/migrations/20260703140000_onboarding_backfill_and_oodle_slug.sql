-- One-off data repair:
-- 1) Mark all team memberships onboarding-complete (stops /setup bounce).
-- 2) Rename workspace slug oodle-1 → oodle (+ portal branding and stored prefs).

UPDATE public.accounts_memberships
SET onboarding_completed = true
WHERE onboarding_completed = false;

DO $$
DECLARE
  v_account_id uuid;
  v_has_personal_mobile boolean;
  v_has_workspace_mobile boolean;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE slug = 'oodle-1'
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE NOTICE 'accounts.slug oodle-1 not found; rename skipped';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE slug = 'oodle'
      AND id <> v_account_id
  ) THEN
    RAISE EXCEPTION 'Cannot rename oodle-1 → oodle: slug oodle is already taken';
  END IF;

  UPDATE public.accounts
  SET slug = 'oodle'
  WHERE id = v_account_id;

  UPDATE public.businesses
  SET slug = 'oodle'
  WHERE account_id = v_account_id
    AND slug = 'oodle-1';

  IF to_regclass('public.agency_branding') IS NOT NULL THEN
    UPDATE public.agency_branding
    SET slug = 'oodle'
    WHERE business_id = v_account_id
      AND slug = 'oodle-1';
  END IF;

  UPDATE public.user_settings
  SET default_workspace_slug = 'oodle'
  WHERE default_workspace_slug = 'oodle-1';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'personal_dashboard_shortcuts'
  ) THEN
    UPDATE public.user_settings
    SET personal_dashboard_shortcuts = replace(
        personal_dashboard_shortcuts::text,
        '/oodle-1',
        '/oodle'
      )::jsonb
    WHERE personal_dashboard_shortcuts::text LIKE '%/oodle-1%';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'personal_mobile_nav_shortcuts'
  ) INTO v_has_personal_mobile;

  IF v_has_personal_mobile THEN
    UPDATE public.user_settings
    SET personal_mobile_nav_shortcuts = replace(
        personal_mobile_nav_shortcuts::text,
        '/oodle-1',
        '/oodle'
      )::jsonb
    WHERE personal_mobile_nav_shortcuts::text LIKE '%/oodle-1%';
  END IF;

  IF to_regclass('public.workspace_dashboard_shortcuts') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'workspace_dashboard_shortcuts'
        AND column_name = 'mobile_nav_shortcuts'
    ) INTO v_has_workspace_mobile;

    IF v_has_workspace_mobile THEN
      UPDATE public.workspace_dashboard_shortcuts
      SET
        shortcuts = replace(shortcuts::text, '/oodle-1', '/oodle')::jsonb,
        mobile_nav_shortcuts = replace(
          mobile_nav_shortcuts::text,
          '/oodle-1',
          '/oodle'
        )::jsonb
      WHERE account_id = v_account_id
        AND (
          shortcuts::text LIKE '%/oodle-1%'
          OR mobile_nav_shortcuts::text LIKE '%/oodle-1%'
        );
    ELSE
      UPDATE public.workspace_dashboard_shortcuts
      SET shortcuts = replace(shortcuts::text, '/oodle-1', '/oodle')::jsonb
      WHERE account_id = v_account_id
        AND shortcuts::text LIKE '%/oodle-1%';
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
