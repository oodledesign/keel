-- Client website / domain for CRM profiles and logo lookup.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS website text;

COMMENT ON COLUMN public.clients.website IS
  'Company website domain or URL (e.g. acme.com). Used for logo lookup and profile display.';
