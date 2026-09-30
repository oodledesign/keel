/*
 * Instruction property & disposal terms.
 *
 * Instructions start as a one-liner ("16 High Street"). These nullable columns
 * let the team capture the property up front so that "Create disposal" can
 * build a populated disposal instead of an empty draft. All are optional.
 * `value` remains the agent's fee; asking_* are the client's asking terms.
 */
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS disposal_type text,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS size_sqft numeric,
  ADD COLUMN IF NOT EXISTS asking_rent_pence bigint,
  ADD COLUMN IF NOT EXISTS asking_price_pence bigint;

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_disposal_type_check;

ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_disposal_type_check
  CHECK (
    disposal_type IS NULL
    OR disposal_type IN ('to_let', 'for_sale', 'investment', 'to_let_and_for_sale')
  );

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_asking_terms_nonnegative;

ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_asking_terms_nonnegative
  CHECK (
    (asking_rent_pence IS NULL OR asking_rent_pence >= 0)
    AND (asking_price_pence IS NULL OR asking_price_pence >= 0)
    AND (size_sqft IS NULL OR size_sqft >= 0)
  );
