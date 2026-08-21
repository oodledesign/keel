-- Dedicated parking fields for Rightmove commercial ADF
-- (amenities.PARKING + parkingSpaces).

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS parking_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking_spaces integer;

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_parking_spaces_nonneg;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_parking_spaces_nonneg
  CHECK (parking_spaces IS NULL OR parking_spaces >= 0);

COMMENT ON COLUMN public.commercial_listings.parking_available IS
  'When true, Rightmove publish includes amenities PARKING.';
COMMENT ON COLUMN public.commercial_listings.parking_spaces IS
  'Optional count of parking spaces sent as Rightmove parkingSpaces.';

-- Backfill from free-text amenities chip.
UPDATE public.commercial_listings
SET parking_available = true
WHERE parking_available = false
  AND amenities IS NOT NULL
  AND jsonb_typeof(amenities) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(amenities) AS a(value)
    WHERE lower(trim(a.value)) = 'parking'
  );
