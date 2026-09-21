-- Persist the GOV.UK certificate attached to a commercial disposal so
-- agents can refresh band/score without a second client fork.
-- Additive only. Unused by building-surveyor / personal / family workspaces.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS epc_certificate_number text,
  ADD COLUMN IF NOT EXISTS epc_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS epc_pulled_json jsonb;

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_epc_certificate_number_format;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_epc_certificate_number_format
  CHECK (
    epc_certificate_number IS NULL
    OR epc_certificate_number ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}$'
  );

COMMENT ON COLUMN public.commercial_listings.epc_certificate_number IS
  'GOV.UK Energy Performance Certificate number attached from the register.';

COMMENT ON COLUMN public.commercial_listings.epc_fetched_at IS
  'When the disposal last pulled EPC band/score from the GOV.UK register.';

COMMENT ON COLUMN public.commercial_listings.epc_pulled_json IS
  'Last auto-pulled { epcBand, epcRating } snapshot. Manual edits stay in epc_band / epc_rating.';

NOTIFY pgrst, 'reload schema';
