-- Public share links for meeting transcripts (summary + transcript + tasks).

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS public_share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS ix_meeting_transcripts_public_share_token
  ON public.meeting_transcripts (public_share_token)
  WHERE public_share_token IS NOT NULL;

COMMENT ON COLUMN public.meeting_transcripts.public_share_enabled IS
  'When true, the meeting is viewable at /share/meetings/[public_share_token] without signing in.';
COMMENT ON COLUMN public.meeting_transcripts.public_share_token IS
  'Unguessable token for the public meeting URL. Generated when sharing is first enabled.';
