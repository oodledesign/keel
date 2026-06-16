-- Meeting date for transcripts (distinct from created_at / import time).

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS meeting_date date;

CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_account_meeting_date
  ON public.meeting_transcripts (account_id, meeting_date DESC NULLS LAST);

COMMENT ON COLUMN public.meeting_transcripts.meeting_date IS
  'Calendar date of the meeting; optional — UI falls back to created_at when null.';
