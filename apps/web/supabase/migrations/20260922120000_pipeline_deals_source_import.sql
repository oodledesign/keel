-- Allow CSV / seed import markers on pipeline_deals.source (idempotent Bracketts WIP import).

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_source_check;

ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_source_check
  CHECK (
    source IS NULL
    OR source IN (
      'referral',
      'website',
      'social',
      'cold',
      'other',
      'bracketts_wip_csv_202605'
    )
  );
