-- user_settings table: profile and accessibility. RLS and updated_at trigger.
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

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.user_settings_updated_at()
RETURNS trigger SET search_path = ''
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

REVOKE ALL ON public.user_settings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO service_role;

CREATE POLICY user_settings_own ON public.user_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
