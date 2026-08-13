-- Lightweight instruction work type for commercial WIP (agency vs professional vs management).

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS work_type text;

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_work_type_check;

ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_work_type_check
  CHECK (
    work_type IS NULL
    OR work_type IN ('agency', 'professional', 'management')
  );

CREATE INDEX IF NOT EXISTS ix_pipeline_deals_account_work_type
  ON public.pipeline_deals (account_id, work_type)
  WHERE work_type IS NOT NULL;

COMMENT ON COLUMN public.pipeline_deals.work_type IS
  'Commercial instruction kind: agency (disposal), professional (valuation/MI), or management.';
