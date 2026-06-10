-- Company website and address for signature templates ({{website}}, {{address}}).

ALTER TABLE public.account_brand_settings
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS address text;

COMMENT ON COLUMN public.account_brand_settings.website_url IS
  'Company website shown in email signatures as {{website}}.';
COMMENT ON COLUMN public.account_brand_settings.address IS
  'Company postal address shown in email signatures as {{address}}.';
