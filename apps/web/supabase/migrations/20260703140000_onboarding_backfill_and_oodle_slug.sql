-- One-off data repair:
-- 1) Mark all team memberships onboarding-complete (stops /setup bounce).
-- 2) Rename workspace slug oodle-1 → oodle (+ portal branding and stored prefs).

UPDATE public.accounts_memberships
SET onboarding_completed = true
WHERE onboarding_completed = false;

-- Remote may have timestamp triggers without matching columns (schema drift).
ALTER TABLE public.agency_branding
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.workspace_dashboard_shortcuts
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS agency_branding_set_timestamps ON public.agency_branding;
CREATE TRIGGER agency_branding_set_timestamps
  BEFORE INSERT OR UPDATE ON public.agency_branding
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DO $$
DECLARE
  v_account_id uuid;
  v_other_oodle_id uuid;
  v_archive_slug text;
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

  SELECT id INTO v_other_oodle_id
  FROM public.accounts
  WHERE slug = 'oodle'
    AND id <> v_account_id
  LIMIT 1;

  -- Free the slug when an older duplicate workspace already uses "oodle".
  IF v_other_oodle_id IS NOT NULL THEN
    v_archive_slug := 'oodle-legacy-' || substr(v_other_oodle_id::text, 1, 8);

    UPDATE public.accounts
    SET slug = v_archive_slug
    WHERE id = v_other_oodle_id;

    UPDATE public.businesses
    SET slug = v_archive_slug
    WHERE account_id = v_other_oodle_id
      AND slug = 'oodle';

    IF to_regclass('public.agency_branding') IS NOT NULL THEN
      UPDATE public.agency_branding
      SET slug = v_archive_slug
      WHERE business_id = v_other_oodle_id
        AND slug = 'oodle';
    END IF;

    UPDATE public.user_settings
    SET default_workspace_slug = v_archive_slug
    WHERE default_workspace_slug = 'oodle';

    RAISE NOTICE 'Archived duplicate workspace % → %', v_other_oodle_id, v_archive_slug;
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
