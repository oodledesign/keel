-- Rename Keel context preference columns to Ozer (idempotent if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'use_keel_for_work'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'use_ozer_for_work'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN use_keel_for_work TO use_ozer_for_work;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'use_keel_for_family'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'use_ozer_for_family'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN use_keel_for_family TO use_ozer_for_family;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'use_keel_for_community'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'use_ozer_for_community'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN use_keel_for_community TO use_ozer_for_community;
  END IF;
END $$;

COMMENT ON COLUMN public.user_settings.use_ozer_for_work IS 'User indicated work/trade use (jobs, clients, billing).';
COMMENT ON COLUMN public.user_settings.use_ozer_for_family IS 'User indicated family/household use.';
COMMENT ON COLUMN public.user_settings.use_ozer_for_community IS 'User indicated clubs, groups, or community use.';
