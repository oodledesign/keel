-- Optional notes on account-scoped calendar events (community sessions, family events).

ALTER TABLE public.account_calendar_events
  ADD COLUMN IF NOT EXISTS session_notes text;

COMMENT ON COLUMN public.account_calendar_events.session_notes IS
  'Agenda or notes attached to a scheduled session.';

NOTIFY pgrst, 'reload schema';
