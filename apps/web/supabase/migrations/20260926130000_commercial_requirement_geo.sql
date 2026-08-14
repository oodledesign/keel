-- Geo fields for commercial requirement search radius matching.
-- Timestamp 20260926130000: 20260926120000 is already used by pending_billable_seats.

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS search_radius_miles numeric;

ALTER TABLE public.commercial_requirements
  DROP CONSTRAINT IF EXISTS commercial_requirements_search_radius_miles_check;

ALTER TABLE public.commercial_requirements
  ADD CONSTRAINT commercial_requirements_search_radius_miles_check
  CHECK (
    search_radius_miles IS NULL
    OR (search_radius_miles >= 0.5 AND search_radius_miles <= 100)
  );

COMMENT ON COLUMN public.commercial_requirements.latitude IS
  'Geocoded latitude for the requirement location / search centre.';

COMMENT ON COLUMN public.commercial_requirements.longitude IS
  'Geocoded longitude for the requirement location / search centre.';

COMMENT ON COLUMN public.commercial_requirements.search_radius_miles IS
  'Optional search radius in miles (0.5–100). When set, listings outside get zero location score.';
