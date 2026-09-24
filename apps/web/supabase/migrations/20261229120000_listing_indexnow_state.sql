-- Remembers the last IndexNow ping per disposal so feed polls and repeat
-- saves do not resubmit the same public listing URL.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS indexnow_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.commercial_listings.indexnow_state IS
  'Last IndexNow attempt for the public listing URL. A success stores url and submittedAt. Failures store attemptUrl and attemptAt so the same URL is not retried on every save.';

NOTIFY pgrst, 'reload schema';
