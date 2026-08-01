-- Opt-in control for showing accepted/extracted tasks on the public meeting share page.

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS public_share_show_tasks boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.meeting_transcripts.public_share_show_tasks IS
  'When true (and public_share_enabled), accepted/extracted tasks are included on the public meeting page.';
