-- Monthly desktop recorder usage per user (sync count + recorded duration).

CREATE TABLE IF NOT EXISTS public.recorder_usage_monthly (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  sync_count integer NOT NULL DEFAULT 0 CHECK (sync_count >= 0),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

CREATE INDEX IF NOT EXISTS ix_recorder_usage_monthly_period
  ON public.recorder_usage_monthly (period);

COMMENT ON TABLE public.recorder_usage_monthly IS
  'Per-user desktop recorder sync usage, rolled up by calendar month (UTC).';

ALTER TABLE public.recorder_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recorder_usage_monthly_select ON public.recorder_usage_monthly;
CREATE POLICY recorder_usage_monthly_select
  ON public.recorder_usage_monthly
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT SELECT ON public.recorder_usage_monthly TO authenticated;
GRANT ALL ON public.recorder_usage_monthly TO service_role;
