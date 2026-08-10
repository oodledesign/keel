-- Enrich commercial listings / units for Kato parity:
-- rent range, service/rates/estate charges, dual disposal, unit marketing attrs, sale POA.

-- Listing: dual to-let + for-sale
ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_disposal_type_check;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_disposal_type_check
  CHECK (
    disposal_type = ANY (
      ARRAY[
        'to_let'::text,
        'for_sale'::text,
        'investment'::text,
        'to_let_and_for_sale'::text
      ]
    )
  );

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS asking_rent_to_pence integer,
  ADD COLUMN IF NOT EXISTS service_charge_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS rates_payable_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS estate_charge_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS hide_price_from_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS possession text,
  ADD COLUMN IF NOT EXISTS build_status text,
  ADD COLUMN IF NOT EXISTS planning_status text,
  ADD COLUMN IF NOT EXISTS fitted_space boolean;

COMMENT ON COLUMN public.commercial_listings.asking_rent_to_pence IS
  'Upper bound of asking rent range in pence (Rent To). asking_rent_pence is the lower / single value.';
COMMENT ON COLUMN public.commercial_listings.service_charge_per_sqft IS
  'Service charge in £ per sq ft.';
COMMENT ON COLUMN public.commercial_listings.rates_payable_per_sqft IS
  'Business rates payable in £ per sq ft.';
COMMENT ON COLUMN public.commercial_listings.estate_charge_per_sqft IS
  'Estate charge in £ per sq ft.';
COMMENT ON COLUMN public.commercial_listings.hide_price_from_marketing IS
  'When true, asking price is withheld publicly (POA) while remaining stored for internal use.';
COMMENT ON COLUMN public.commercial_listings.possession IS
  'Possession timing / state (e.g. immediate, by arrangement).';
COMMENT ON COLUMN public.commercial_listings.build_status IS
  'Build status (e.g. complete, under construction).';
COMMENT ON COLUMN public.commercial_listings.planning_status IS
  'Planning status summary.';
COMMENT ON COLUMN public.commercial_listings.fitted_space IS
  'Whether space is fitted.';

-- Units: richer floor/unit attributes
ALTER TABLE public.commercial_listing_units
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS part_floor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS tenure text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS asking_rent_pence integer,
  ADD COLUMN IF NOT EXISTS rent_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS service_charge_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS rates_payable_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS estate_charge_per_sqft numeric,
  ADD COLUMN IF NOT EXISTS epc_band text,
  ADD COLUMN IF NOT EXISTS possession text,
  ADD COLUMN IF NOT EXISTS build_status text,
  ADD COLUMN IF NOT EXISTS planning_status text,
  ADD COLUMN IF NOT EXISTS fitted_space boolean,
  ADD COLUMN IF NOT EXISTS size_accuracy text,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.commercial_listing_units.asking_rent_pence IS
  'Unit asking rent in pence (typically per annum).';
COMMENT ON COLUMN public.commercial_listing_units.rent_per_sqft IS
  'Unit rent in £ per sq ft when quoted that way.';
COMMENT ON COLUMN public.commercial_listing_units.part_floor IS
  'Whether this unit is a part floor.';
