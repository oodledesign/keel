-- Family workspace: weekly meal plan days and account-scoped calendar events.

CREATE TABLE IF NOT EXISTS public.meal_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, plan_date)
);

CREATE INDEX IF NOT EXISTS ix_meal_plan_days_account_date
  ON public.meal_plan_days(account_id, plan_date);

COMMENT ON TABLE public.meal_plan_days IS
  'Per-day meal plan summary for family (and similar) workspaces.';

CREATE TABLE IF NOT EXISTS public.account_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_account_calendar_events_account_start
  ON public.account_calendar_events(account_id, starts_at);

COMMENT ON TABLE public.account_calendar_events IS
  'Calendar events scoped to an account (family/community) without requiring a job.';

DROP TRIGGER IF EXISTS meal_plan_days_set_timestamps ON public.meal_plan_days;
CREATE TRIGGER meal_plan_days_set_timestamps
  BEFORE INSERT OR UPDATE ON public.meal_plan_days
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS account_calendar_events_set_timestamps ON public.account_calendar_events;
CREATE TRIGGER account_calendar_events_set_timestamps
  BEFORE INSERT OR UPDATE ON public.account_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_calendar_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_days TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_calendar_events TO authenticated, service_role;

DROP POLICY IF EXISTS meal_plan_days_select ON public.meal_plan_days;
CREATE POLICY meal_plan_days_select ON public.meal_plan_days FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS meal_plan_days_insert ON public.meal_plan_days;
CREATE POLICY meal_plan_days_insert ON public.meal_plan_days FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS meal_plan_days_update ON public.meal_plan_days;
CREATE POLICY meal_plan_days_update ON public.meal_plan_days FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS meal_plan_days_delete ON public.meal_plan_days;
CREATE POLICY meal_plan_days_delete ON public.meal_plan_days FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS account_calendar_events_select ON public.account_calendar_events;
CREATE POLICY account_calendar_events_select ON public.account_calendar_events FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS account_calendar_events_insert ON public.account_calendar_events;
CREATE POLICY account_calendar_events_insert ON public.account_calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS account_calendar_events_update ON public.account_calendar_events;
CREATE POLICY account_calendar_events_update ON public.account_calendar_events FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS account_calendar_events_delete ON public.account_calendar_events;
CREATE POLICY account_calendar_events_delete ON public.account_calendar_events FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

NOTIFY pgrst, 'reload schema';
