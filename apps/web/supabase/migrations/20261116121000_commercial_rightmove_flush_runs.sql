-- Log each Rightmove unsynced flush so super-admin can see the last run.

CREATE TABLE IF NOT EXISTS public.commercial_rightmove_flush_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  processed integer NOT NULL DEFAULT 0
    CHECK (processed >= 0),
  succeeded integer NOT NULL DEFAULT 0
    CHECK (succeeded >= 0),
  failed integer NOT NULL DEFAULT 0
    CHECK (failed >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_rightmove_flush_runs IS
  'Platform-wide Rightmove unsynced flush runs (cron ~every 15 minutes).';

CREATE INDEX IF NOT EXISTS commercial_rightmove_flush_runs_started_at_idx
  ON public.commercial_rightmove_flush_runs (started_at DESC);

ALTER TABLE public.commercial_rightmove_flush_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_rightmove_flush_runs FROM authenticated, service_role;
GRANT SELECT ON public.commercial_rightmove_flush_runs TO authenticated;
GRANT ALL ON public.commercial_rightmove_flush_runs TO service_role;

CREATE POLICY commercial_rightmove_flush_runs_select
  ON public.commercial_rightmove_flush_runs
  FOR SELECT TO authenticated
  USING (false);
