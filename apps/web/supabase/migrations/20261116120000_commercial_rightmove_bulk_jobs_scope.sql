-- Persist whether a Rightmove bulk job is a full push or an unsynced re-sync.

ALTER TABLE public.commercial_rightmove_bulk_jobs
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all';

ALTER TABLE public.commercial_rightmove_bulk_jobs
  DROP CONSTRAINT IF EXISTS commercial_rightmove_bulk_jobs_scope_check;

ALTER TABLE public.commercial_rightmove_bulk_jobs
  ADD CONSTRAINT commercial_rightmove_bulk_jobs_scope_check
  CHECK (scope IN ('all', 'unsynced'));

COMMENT ON COLUMN public.commercial_rightmove_bulk_jobs.scope IS
  'all = every Marketing / Under offer disposal (including first-time). unsynced = already live on Rightmove but behind.';
