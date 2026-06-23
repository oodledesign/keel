-- Structured speaker segments for meeting transcripts (rename labels post-sync).

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS speaker_segments jsonb;

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_speaker_segments_check;

ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_speaker_segments_check
  CHECK (
    speaker_segments IS NULL
    OR jsonb_typeof(speaker_segments) = 'array'
  );

COMMENT ON COLUMN public.meeting_transcripts.speaker_segments IS
  'Ordered [{speaker, text}] segments; content is denormalized from this when present.';

NOTIFY pgrst, 'reload schema';
