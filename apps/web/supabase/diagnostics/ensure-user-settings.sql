-- Ensure public.user_settings exists (profile, accessibility, Ozer “how you use” flags).
-- Use when the app errors with: Could not find the table 'public.user_settings' in the schema cache
-- (PostgREST has no such table — usually migrations were not applied to this project).
--
-- Run in Supabase Dashboard → SQL Editor. Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  mobile text,

  accessibility_text_size text NOT NULL DEFAULT 'standard'
    CHECK (accessibility_text_size IN ('small','standard','large')),

  accessibility_high_contrast boolean NOT NULL DEFAULT false,
  accessibility_simplified_mode boolean NOT NULL DEFAULT true,
  accessibility_enhanced_focus boolean NOT NULL DEFAULT true,
  accessibility_dyslexia_font boolean NOT NULL DEFAULT false,

  use_ozer_for_work boolean NOT NULL DEFAULT false,
  use_ozer_for_family boolean NOT NULL DEFAULT false,
  use_ozer_for_community boolean NOT NULL DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migrate legacy Keel column names if present (before ADD COLUMN for ozer_*).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'use_keel_for_work'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'use_ozer_for_work'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN use_keel_for_work TO use_ozer_for_work;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'use_keel_for_family'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'use_ozer_for_family'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN use_keel_for_family TO use_ozer_for_family;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'use_keel_for_community'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'use_ozer_for_community'
  ) THEN
    ALTER TABLE public.user_settings
      RENAME COLUMN use_keel_for_community TO use_ozer_for_community;
  END IF;
END $$;

-- If the table already existed without context columns, add Ozer columns when missing.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS use_ozer_for_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_ozer_for_family boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_ozer_for_community boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.user_settings_updated_at()
RETURNS trigger
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.user_settings_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_own ON public.user_settings;
CREATE POLICY user_settings_own ON public.user_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.user_settings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO service_role;

-- Nudge PostgREST to reload schema (helps right after manual DDL in the dashboard).
NOTIFY pgrst, 'reload schema';
