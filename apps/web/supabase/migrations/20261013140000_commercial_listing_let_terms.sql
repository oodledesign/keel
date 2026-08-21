-- Rightmove lettings fields: letType + letContractLength (months).

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS let_type text,
  ADD COLUMN IF NOT EXISTS let_contract_length_months integer;

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_let_type_check;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_let_type_check
  CHECK (
    let_type IS NULL
    OR let_type IN ('SHORT', 'LONG', 'FLEXIBLE', 'NOT_SPECIFIED')
  );

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_let_contract_length_nonneg;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_let_contract_length_nonneg
  CHECK (
    let_contract_length_months IS NULL
    OR let_contract_length_months >= 0
  );

COMMENT ON COLUMN public.commercial_listings.let_type IS
  'Rightmove ADF letType for lettings (SHORT | LONG | FLEXIBLE | NOT_SPECIFIED).';
COMMENT ON COLUMN public.commercial_listings.let_contract_length_months IS
  'Rightmove ADF letContractLength in months (lettings only).';
