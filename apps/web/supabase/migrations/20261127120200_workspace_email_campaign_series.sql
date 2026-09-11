-- Recurring email campaigns: parent series + instance campaigns.
-- Instances are normal workspace_email_campaigns rows linked by series_id.
-- They start draft / not ready and must never send until marked ready.

CREATE TABLE IF NOT EXISTS public.workspace_email_campaign_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/London',
  recurrence_freq text NOT NULL DEFAULT 'weekly'
    CHECK (recurrence_freq IN ('weekly', 'monthly')),
  recurrence_interval integer NOT NULL DEFAULT 1
    CHECK (recurrence_interval BETWEEN 1 AND 52),
  -- ISO weekday: 1 = Monday … 7 = Sunday (weekly).
  recurrence_by_weekday integer
    CHECK (recurrence_by_weekday BETWEEN 1 AND 7),
  -- Calendar day 1–31 (monthly; clamp to last day of month in app).
  recurrence_by_monthday integer
    CHECK (recurrence_by_monthday BETWEEN 1 AND 31),
  send_hour integer NOT NULL DEFAULT 12
    CHECK (send_hour BETWEEN 0 AND 23),
  send_minute integer NOT NULL DEFAULT 0
    CHECK (send_minute BETWEEN 0 AND 59),
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  generate_ahead integer NOT NULL DEFAULT 4
    CHECK (generate_ahead BETWEEN 1 AND 12),
  audience_type text NOT NULL DEFAULT 'subscribers',
  audience_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject text NOT NULL DEFAULT '',
  preview_text text,
  body_document jsonb,
  html_body text NOT NULL DEFAULT '',
  from_name text,
  from_email text,
  reply_to text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_email_campaign_series_name_len
    CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT workspace_email_campaign_series_subject_len
    CHECK (char_length(subject) <= 300),
  CONSTRAINT workspace_email_campaign_series_weekly_dow
    CHECK (
      recurrence_freq <> 'weekly'
      OR recurrence_by_weekday IS NOT NULL
    ),
  CONSTRAINT workspace_email_campaign_series_monthly_dom
    CHECK (
      recurrence_freq <> 'monthly'
      OR recurrence_by_monthday IS NOT NULL
    ),
  CONSTRAINT workspace_email_campaign_series_ends_on
    CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

COMMENT ON TABLE public.workspace_email_campaign_series IS
  'Parent config for recurring workspace email campaigns. Instances are workspace_email_campaigns rows.';

COMMENT ON COLUMN public.workspace_email_campaign_series.recurrence_freq IS
  'v1 UI is weekly only. monthly is reserved so a later release can add day-of-month without a reshape.';

COMMENT ON COLUMN public.workspace_email_campaign_series.generate_ahead IS
  'How many future draft instances to keep generated (default 4).';

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_series_account
  ON public.workspace_email_campaign_series (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_series_active
  ON public.workspace_email_campaign_series (account_id, id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS workspace_email_campaign_series_set_timestamps
  ON public.workspace_email_campaign_series;
CREATE TRIGGER workspace_email_campaign_series_set_timestamps
BEFORE INSERT OR UPDATE ON public.workspace_email_campaign_series
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS series_id uuid
    REFERENCES public.workspace_email_campaign_series (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_key text,
  ADD COLUMN IF NOT EXISTS ready boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.workspace_email_campaigns.series_id IS
  'When set, this campaign is one occurrence of a recurring series.';

COMMENT ON COLUMN public.workspace_email_campaigns.occurrence_key IS
  'Stable occurrence id (YYYY-MM-DD in the series timezone). Unique per series.';

COMMENT ON COLUMN public.workspace_email_campaigns.ready IS
  'Series instances start false and must be marked ready before send. One-off campaigns default true.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_email_campaigns_series_occurrence
  ON public.workspace_email_campaigns (series_id, occurrence_key)
  WHERE series_id IS NOT NULL AND occurrence_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaigns_series_due
  ON public.workspace_email_campaigns (series_id, scheduled_at)
  WHERE series_id IS NOT NULL;

-- RLS
ALTER TABLE public.workspace_email_campaign_series ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_email_campaign_series
  FROM anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_email_campaign_series
  TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_email_campaign_series_select
  ON public.workspace_email_campaign_series;
CREATE POLICY workspace_email_campaign_series_select
  ON public.workspace_email_campaign_series
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_series_insert
  ON public.workspace_email_campaign_series;
CREATE POLICY workspace_email_campaign_series_insert
  ON public.workspace_email_campaign_series
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_series_update
  ON public.workspace_email_campaign_series;
CREATE POLICY workspace_email_campaign_series_update
  ON public.workspace_email_campaign_series
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_series_delete
  ON public.workspace_email_campaign_series;
CREATE POLICY workspace_email_campaign_series_delete
  ON public.workspace_email_campaign_series
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_series_service_role
  ON public.workspace_email_campaign_series;
CREATE POLICY workspace_email_campaign_series_service_role
  ON public.workspace_email_campaign_series
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
