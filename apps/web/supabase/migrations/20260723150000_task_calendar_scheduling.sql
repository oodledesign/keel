-- Part A Task 5: calendar selection on connections + task scheduling metadata.

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS busy_calendar_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS personal_calendar_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.google_calendar_connections.busy_calendar_ids IS
  'Google calendar IDs included when finding free slots for auto-scheduling. Empty = all selected calendars.';

COMMENT ON COLUMN public.google_calendar_connections.personal_calendar_ids IS
  'Subset of busy calendars treated as personal; excluded when account exclude_personal_calendar_busy is true.';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS calendar_schedule_status text;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_calendar_schedule_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_calendar_schedule_status_check CHECK (
    calendar_schedule_status IS NULL
    OR calendar_schedule_status IN ('scheduled', 'failed')
  );

COMMENT ON COLUMN public.tasks.google_calendar_event_id IS
  'Google Calendar event created by auto-scheduling for this planner task.';

COMMENT ON COLUMN public.tasks.calendar_schedule_status IS
  'scheduled = event created; failed = no slot found before due date.';

NOTIFY pgrst, 'reload schema';
