-- Optional estimated effort for tasks and subtasks (including project tasks).
-- Stored as minutes so hours + minutes stay a single integer.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_duration_minutes_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_duration_minutes_check
  CHECK (
    duration_minutes IS NULL
    OR (duration_minutes > 0 AND duration_minutes <= 10080)
  );

COMMENT ON COLUMN public.tasks.duration_minutes IS
  'Optional estimated effort in minutes (max 7 days). Null when unset.';

ALTER TABLE public.email_action_items
  ADD COLUMN IF NOT EXISTS suggested_duration_minutes integer;

ALTER TABLE public.email_action_items
  DROP CONSTRAINT IF EXISTS email_action_items_suggested_duration_minutes_check;

ALTER TABLE public.email_action_items
  ADD CONSTRAINT email_action_items_suggested_duration_minutes_check
  CHECK (
    suggested_duration_minutes IS NULL
    OR (
      suggested_duration_minutes > 0
      AND suggested_duration_minutes <= 10080
    )
  );

COMMENT ON COLUMN public.email_action_items.suggested_duration_minutes IS
  'Optional duration inferred from the email when mentioned; null otherwise.';

ALTER TABLE public.meeting_action_items
  ADD COLUMN IF NOT EXISTS suggested_duration_minutes integer;

ALTER TABLE public.meeting_action_items
  DROP CONSTRAINT IF EXISTS meeting_action_items_suggested_duration_minutes_check;

ALTER TABLE public.meeting_action_items
  ADD CONSTRAINT meeting_action_items_suggested_duration_minutes_check
  CHECK (
    suggested_duration_minutes IS NULL
    OR (
      suggested_duration_minutes > 0
      AND suggested_duration_minutes <= 10080
    )
  );

COMMENT ON COLUMN public.meeting_action_items.suggested_duration_minutes IS
  'Optional duration inferred from the transcript when mentioned; null otherwise.';

ALTER TABLE public.task_recurring_series
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE public.task_recurring_series
  DROP CONSTRAINT IF EXISTS task_recurring_series_duration_minutes_check;

ALTER TABLE public.task_recurring_series
  ADD CONSTRAINT task_recurring_series_duration_minutes_check
  CHECK (
    duration_minutes IS NULL
    OR (duration_minutes > 0 AND duration_minutes <= 10080)
  );

COMMENT ON COLUMN public.task_recurring_series.duration_minutes IS
  'Optional estimated effort copied onto each spawned occurrence.';

NOTIFY pgrst, 'reload schema';
