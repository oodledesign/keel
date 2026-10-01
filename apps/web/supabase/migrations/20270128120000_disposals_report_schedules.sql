-- Scheduled availability reports and "changed since last export" snapshots.
--   * commercial_report_schedules: a recurring emailed availability schedule
--     (columns, offices, statuses, recipients, days and time).
--   * commercial_export_snapshots: what each export looked like, so the next
--     one can mark what is new, changed or no longer listed.

-- ---------------------------------------------------------------------------
-- 1. Scheduled reports (owners and admins manage them)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL
    CONSTRAINT commercial_report_schedules_name_check
      CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  -- 0 = Sunday … 6 = Saturday, in UK time.
  days_of_week smallint[] NOT NULL DEFAULT '{1}',
  -- Hour of day, UK time.
  send_hour smallint NOT NULL DEFAULT 8
    CONSTRAINT commercial_report_schedules_hour_check
      CHECK (send_hour BETWEEN 0 AND 23),
  recipients text[] NOT NULL
    CONSTRAINT commercial_report_schedules_recipients_check
      CHECK (cardinality(recipients) BETWEEN 1 AND 20),
  -- Same shape as the export dialog: columns, statuses, officeIds, groupBy, sortBy.
  options jsonb NOT NULL,
  -- Any of pdf, xlsx, csv.
  attachments text[] NOT NULL DEFAULT '{pdf}',
  only_when_changed boolean NOT NULL DEFAULT false,
  -- Last time the cron looked at this schedule (sent, skipped or failed).
  last_run_at timestamptz,
  -- sent, skipped or failed.
  last_status text
    CONSTRAINT commercial_report_schedules_status_check
      CHECK (last_status IS NULL OR last_status IN ('sent', 'skipped', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_report_schedules_days_check
    CHECK (
      cardinality(days_of_week) BETWEEN 1 AND 7
      AND days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
    ),
  CONSTRAINT commercial_report_schedules_attachments_check
    CHECK (attachments <@ ARRAY['pdf', 'xlsx', 'csv']::text[])
);

COMMENT ON TABLE public.commercial_report_schedules IS
  'Recurring emailed availability schedules for commercial workspaces.';

CREATE INDEX IF NOT EXISTS ix_commercial_report_schedules_account
  ON public.commercial_report_schedules (account_id);

DROP TRIGGER IF EXISTS commercial_report_schedules_set_timestamps
  ON public.commercial_report_schedules;
CREATE TRIGGER commercial_report_schedules_set_timestamps
  BEFORE INSERT OR UPDATE ON public.commercial_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.commercial_report_schedules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_report_schedules FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.commercial_report_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.commercial_report_schedules TO service_role;

DROP POLICY IF EXISTS commercial_report_schedules_manage
  ON public.commercial_report_schedules;
CREATE POLICY commercial_report_schedules_manage
  ON public.commercial_report_schedules
  FOR ALL TO authenticated
  USING (
    public.has_role_on_account (account_id, 'owner')
    OR public.has_role_on_account (account_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_account (account_id, 'owner')
    OR public.has_role_on_account (account_id, 'admin')
  );

-- ---------------------------------------------------------------------------
-- 2. Export snapshots (server only: written by the export and cron routes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_export_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  -- "user:<id>:<hash of offices and statuses>" or "schedule:<id>".
  snapshot_key text NOT NULL,
  snapshot jsonb NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  previous_snapshot jsonb,
  previous_taken_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_export_snapshots_key UNIQUE (account_id, snapshot_key)
);

COMMENT ON TABLE public.commercial_export_snapshots IS
  'Per-user and per-schedule record of the last availability export, for change tracking.';

DROP TRIGGER IF EXISTS commercial_export_snapshots_set_timestamps
  ON public.commercial_export_snapshots;
CREATE TRIGGER commercial_export_snapshots_set_timestamps
  BEFORE INSERT OR UPDATE ON public.commercial_export_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.commercial_export_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_export_snapshots FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.commercial_export_snapshots TO service_role;

NOTIFY pgrst, 'reload schema';
