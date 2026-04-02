-- How the member plans to use Keel (onboarding + preferences). Optional multi-select.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS use_keel_for_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_keel_for_family boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_keel_for_community boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.use_keel_for_work IS 'User indicated work/trade use (jobs, clients, billing).';
COMMENT ON COLUMN public.user_settings.use_keel_for_family IS 'User indicated family/household use.';
COMMENT ON COLUMN public.user_settings.use_keel_for_community IS 'User indicated clubs, groups, or community use.';
