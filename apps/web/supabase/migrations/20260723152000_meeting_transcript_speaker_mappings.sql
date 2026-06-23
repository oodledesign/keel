-- Link transcript speaker keys to clients, contacts, or custom names.

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS speaker_mappings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_speaker_mappings_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_speaker_mappings_check
  CHECK (jsonb_typeof(speaker_mappings) = 'object');

COMMENT ON COLUMN public.meeting_transcripts.speaker_mappings IS
  'Maps sync speaker keys (e.g. Speaker 1) to {type: custom|client|contact, ...}. Display names resolve from linked records.';

NOTIFY pgrst, 'reload schema';
