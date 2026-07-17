-- Business contact details for invoices and client-facing documents.

ALTER TABLE public.account_brand_settings
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.account_brand_settings.contact_email IS
  'Public business email shown on invoices and documents.';
COMMENT ON COLUMN public.account_brand_settings.phone IS
  'Public business phone shown on invoices and documents.';
