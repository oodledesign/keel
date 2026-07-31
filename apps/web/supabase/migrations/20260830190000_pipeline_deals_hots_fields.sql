-- Commercial deal HoTs / completion fields for agency pipeline.
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS hots_rent_psf numeric,
  ADD COLUMN IF NOT EXISTS hots_size_sqft numeric,
  ADD COLUMN IF NOT EXISTS hots_lease_years numeric,
  ADD COLUMN IF NOT EXISTS hots_incentives text,
  ADD COLUMN IF NOT EXISTS hots_solicitor_name text,
  ADD COLUMN IF NOT EXISTS hots_target_exchange_date date,
  ADD COLUMN IF NOT EXISTS hots_notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.pipeline_deals.hots_rent_psf IS
  'Heads of Terms headline rent (£/sqft) for commercial deals.';
COMMENT ON COLUMN public.pipeline_deals.completed_at IS
  'When the commercial deal moved to completed.';
