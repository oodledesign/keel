-- Kato feed extras: land size, lease insurance, Google Street View pano.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS land_size_min numeric,
  ADD COLUMN IF NOT EXISTS land_size_max numeric,
  ADD COLUMN IF NOT EXISTS land_size_metric text,
  ADD COLUMN IF NOT EXISTS insurance_type text,
  ADD COLUMN IF NOT EXISTS street_view_pano_id text,
  ADD COLUMN IF NOT EXISTS street_view_heading double precision,
  ADD COLUMN IF NOT EXISTS street_view_pitch double precision,
  ADD COLUMN IF NOT EXISTS street_view_zoom double precision;

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_land_size_metric_check;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_land_size_metric_check
  CHECK (
    land_size_metric IS NULL
    OR land_size_metric = ANY (ARRAY['hectare'::text, 'acres'::text, 'sqft'::text, 'sqm'::text])
  );

COMMENT ON COLUMN public.commercial_listings.land_size_min IS
  'Site / land size lower bound in land_size_metric units.';
COMMENT ON COLUMN public.commercial_listings.land_size_max IS
  'Site / land size upper bound in land_size_metric units.';
COMMENT ON COLUMN public.commercial_listings.land_size_metric IS
  'Unit for land_size_min/max: hectare | acres | sqft | sqm.';
COMMENT ON COLUMN public.commercial_listings.insurance_type IS
  'Lease repairing / insuring basis (e.g. FRI, IRI). Not Terms of Engagement.';
COMMENT ON COLUMN public.commercial_listings.street_view_pano_id IS
  'Google Street View panorama id from the Kato feed.';

NOTIFY pgrst, 'reload schema';
