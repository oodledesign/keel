-- Part B Task 2: assignee precision fields on email_action_items
-- Task 1a: calendar attendee metadata on meeting_transcripts (for recap emails)

ALTER TABLE public.email_action_items
  ADD COLUMN IF NOT EXISTS source_excerpt text,
  ADD COLUMN IF NOT EXISTS assignee_confidence numeric(4, 3),
  ADD COLUMN IF NOT EXISTS suggested_assignee_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.email_action_items
  DROP CONSTRAINT IF EXISTS email_action_items_assignee_confidence_check;

ALTER TABLE public.email_action_items
  ADD CONSTRAINT email_action_items_assignee_confidence_check
  CHECK (
    assignee_confidence IS NULL
    OR (assignee_confidence >= 0 AND assignee_confidence <= 1)
  );

COMMENT ON COLUMN public.email_action_items.source_excerpt IS
  'Verbatim snippet from the email thread that supports this suggested task.';

COMMENT ON COLUMN public.email_action_items.assignee_confidence IS
  'Model confidence (0-1) that suggested_assignee_id is the correct assignee.';

COMMENT ON COLUMN public.email_action_items.suggested_assignee_id IS
  'Resolved workspace member assignee; NULL when ambiguous or unassigned.';

CREATE INDEX IF NOT EXISTS idx_email_action_items_suggested_assignee
  ON public.email_action_items (suggested_assignee_id)
  WHERE suggested_assignee_id IS NOT NULL;

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS calendar_event_id text,
  ADD COLUMN IF NOT EXISTS calendar_event_start timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_event_end timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_attendees jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_calendar_attendees_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_calendar_attendees_check
  CHECK (jsonb_typeof(calendar_attendees) = 'array');

COMMENT ON COLUMN public.meeting_transcripts.calendar_event_id IS
  'Google Calendar event id matched at desktop-recorder sync time.';

COMMENT ON COLUMN public.meeting_transcripts.calendar_event_start IS
  'Start time of the matched calendar event.';

COMMENT ON COLUMN public.meeting_transcripts.calendar_event_end IS
  'End time of the matched calendar event.';

COMMENT ON COLUMN public.meeting_transcripts.calendar_attendees IS
  'Verified attendee list from calendar at sync: [{ "name": string, "email": string }].';
