-- Recurring task series (mirrors invoice_recurring_series).
-- Each run creates a normal tasks row linked via recurring_series_id.

CREATE TABLE IF NOT EXISTS public.task_recurring_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  notes text,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas (id) ON DELETE SET NULL,
  frequency text NOT NULL
    CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  -- Day of month for monthly/quarterly/yearly creates (1–31, clamped to month length).
  -- NULL for weekly/fortnightly (weekday implied by next_create_at).
  day_of_month integer
    CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  next_create_at timestamptz NOT NULL,
  -- Days after each create date for the spawned task's due_date (0 = due same day).
  due_days integer NOT NULL DEFAULT 0
    CHECK (due_days >= 0 AND due_days <= 365),
  end_at timestamptz,
  max_occurrences integer CHECK (max_occurrences IS NULL OR max_occurrences >= 1),
  occurrences_created integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_task_recurring_series_user_status
  ON public.task_recurring_series (user_id, status);

CREATE INDEX IF NOT EXISTS ix_task_recurring_series_account_status
  ON public.task_recurring_series (account_id, status)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_task_recurring_series_next_create
  ON public.task_recurring_series (next_create_at)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS task_recurring_series_set_timestamps ON public.task_recurring_series;
CREATE TRIGGER task_recurring_series_set_timestamps
  BEFORE INSERT OR UPDATE ON public.task_recurring_series
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurring_series_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_recurring_series_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_recurring_series_id_fkey
      FOREIGN KEY (recurring_series_id)
      REFERENCES public.task_recurring_series (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_tasks_recurring_series_id
  ON public.tasks (recurring_series_id)
  WHERE recurring_series_id IS NOT NULL;

COMMENT ON TABLE public.task_recurring_series IS
  'Schedule that spawns tasks on a cadence (weekly/monthly/etc.), similar to invoice_recurring_series.';
COMMENT ON COLUMN public.task_recurring_series.day_of_month IS
  'For monthly/quarterly/yearly: calendar day to create the next task (clamped to month length).';
COMMENT ON COLUMN public.task_recurring_series.due_days IS
  'Days after each create date for the spawned task due_date (0 = same day).';
COMMENT ON COLUMN public.tasks.recurring_series_id IS
  'When set, this task was created from a recurring series.';

ALTER TABLE public.task_recurring_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_recurring_series_select ON public.task_recurring_series;
CREATE POLICY task_recurring_series_select ON public.task_recurring_series
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      account_id IS NOT NULL
      AND public.has_role_on_account(account_id)
    )
  );

DROP POLICY IF EXISTS task_recurring_series_insert ON public.task_recurring_series;
CREATE POLICY task_recurring_series_insert ON public.task_recurring_series
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      account_id IS NULL
      OR public.has_role_on_account(account_id)
    )
  );

DROP POLICY IF EXISTS task_recurring_series_update ON public.task_recurring_series;
CREATE POLICY task_recurring_series_update ON public.task_recurring_series
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS task_recurring_series_delete ON public.task_recurring_series;
CREATE POLICY task_recurring_series_delete ON public.task_recurring_series
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_recurring_series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_recurring_series TO service_role;

NOTIFY pgrst, 'reload schema';
