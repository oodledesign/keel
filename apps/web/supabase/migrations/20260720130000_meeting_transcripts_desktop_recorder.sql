-- Desktop recorder support: source value, recorded_at, and duration on meeting_transcripts.

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_source_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_source_check
  CHECK (source = ANY (ARRAY['paste'::text, 'upload'::text, 'desktop_recorder'::text]));

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

COMMENT ON COLUMN public.meeting_transcripts.recorded_at IS
  'When the meeting took place; distinct from created_at (sync/import time).';

COMMENT ON COLUMN public.meeting_transcripts.duration_seconds IS
  'Recording length in seconds from the desktop recorder, when available.';
