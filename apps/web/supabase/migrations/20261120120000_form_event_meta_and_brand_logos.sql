-- Event date/time meta on workspace forms (same pattern as event_address).
-- Light/dark brand logos for public pages that sit on light vs dark backgrounds.

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS event_date text;

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS event_time text;

COMMENT ON COLUMN public.workspace_forms.event_date IS
  'Optional event date shown on the public RSVP page (form meta, not a submitter question).';

COMMENT ON COLUMN public.workspace_forms.event_time IS
  'Optional event time shown on the public RSVP page (form meta, not a submitter question).';

ALTER TABLE public.account_brand_settings
  ADD COLUMN IF NOT EXISTS logo_on_light_url text;

ALTER TABLE public.account_brand_settings
  ADD COLUMN IF NOT EXISTS logo_on_dark_url text;

COMMENT ON COLUMN public.account_brand_settings.logo_on_light_url IS
  'Logo for light backgrounds (light-mode). Falls back to logo_url when unset.';

COMMENT ON COLUMN public.account_brand_settings.logo_on_dark_url IS
  'Logo for dark backgrounds (dark-mode). Falls back to logo_url when unset.';

NOTIFY pgrst, 'reload schema';
