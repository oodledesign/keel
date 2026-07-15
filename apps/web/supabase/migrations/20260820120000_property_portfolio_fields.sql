-- Portfolio-summary fields on properties (mirrors the mortgage broker
-- portfolio spreadsheet: owner, rent, remortgage, letting flags, style).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS registered_owner text,
  ADD COLUMN IF NOT EXISTS remortgage_date date,
  ADD COLUMN IF NOT EXISTS monthly_rent bigint,
  ADD COLUMN IF NOT EXISTS is_limited_company boolean,
  ADD COLUMN IF NOT EXISTS is_hmo boolean,
  ADD COLUMN IF NOT EXISTS is_family_let boolean,
  ADD COLUMN IF NOT EXISTS is_tenanted boolean,
  ADD COLUMN IF NOT EXISTS building_type text,
  ADD COLUMN IF NOT EXISTS property_style text;

COMMENT ON COLUMN public.properties.registered_owner IS
  'Registered legal owner (person or limited company name).';
COMMENT ON COLUMN public.properties.remortgage_date IS
  'Date of any remortgage / further advance.';
COMMENT ON COLUMN public.properties.monthly_rent IS
  'Monthly rent in the smallest currency unit (pence/cents).';
COMMENT ON COLUMN public.properties.is_limited_company IS
  'Owned via a limited company (null = unknown).';
COMMENT ON COLUMN public.properties.is_hmo IS
  'House in multiple occupation (null = unknown).';
COMMENT ON COLUMN public.properties.is_family_let IS
  'Let to family members (null = unknown).';
COMMENT ON COLUMN public.properties.is_tenanted IS
  'Currently tenanted (null = unknown).';
COMMENT ON COLUMN public.properties.building_type IS
  'Building type, e.g. House / Flat / Bungalow / Maisonette.';
COMMENT ON COLUMN public.properties.property_style IS
  'Property style, e.g. Terrace / Semi-detached / Detached.';

NOTIFY pgrst, 'reload schema';
