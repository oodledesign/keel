-- Scheduling: weekly availability sets per workspace (account_id).
-- Public booking must use service-role server routes only — no anonymous RLS.

CREATE TABLE IF NOT EXISTS public.availability_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/London',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.availability_schedules IS
  'Named weekly availability sets per workspace (e.g. Client calls). Public booking reads via service-role only.';

COMMENT ON COLUMN public.availability_schedules.account_id IS
  'Workspace (accounts.id). Prefer account_id over workspace_id.';

CREATE INDEX IF NOT EXISTS availability_schedules_account_id_idx
  ON public.availability_schedules (account_id);

CREATE TABLE IF NOT EXISTS public.availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.availability_schedules (id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_rules_day_of_week_check
    CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT availability_rules_check
    CHECK (end_time > start_time)
);

COMMENT ON TABLE public.availability_rules IS
  'Weekly rules within an availability schedule. day_of_week: 0 = Sunday … 6 = Saturday.';

CREATE INDEX IF NOT EXISTS availability_rules_schedule_id_idx
  ON public.availability_rules (schedule_id);

CREATE TABLE IF NOT EXISTS public.availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.availability_schedules (id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_overrides_schedule_id_date_key UNIQUE (schedule_id, date),
  CONSTRAINT availability_overrides_check
    CHECK (
      (start_time IS NULL AND end_time IS NULL)
      OR (
        start_time IS NOT NULL
        AND end_time IS NOT NULL
        AND end_time > start_time
      )
    )
);

COMMENT ON TABLE public.availability_overrides IS
  'Date-specific overrides. Both start_time and end_time null = fully unavailable that date.';

CREATE INDEX IF NOT EXISTS availability_overrides_schedule_id_idx
  ON public.availability_overrides (schedule_id);

DROP TRIGGER IF EXISTS availability_schedules_set_timestamps
  ON public.availability_schedules;
CREATE TRIGGER availability_schedules_set_timestamps
  BEFORE INSERT OR UPDATE ON public.availability_schedules
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_schedules TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_rules TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_overrides TO authenticated, service_role;
