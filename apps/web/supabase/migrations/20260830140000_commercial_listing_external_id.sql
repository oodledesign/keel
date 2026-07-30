-- External IDs for Kato (and other CRM) bulk imports / re-imports.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE public.commercial_listing_units
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_listings_account_external_id_uidx
  ON public.commercial_listings (account_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_listing_units_account_external_id_uidx
  ON public.commercial_listing_units (account_id, external_id)
  WHERE external_id IS NOT NULL;
