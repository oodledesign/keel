-- Link meeting transcripts to delivery projects.

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_account_project_id
  ON public.meeting_transcripts (account_id, project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.meeting_transcripts.project_id IS
  'Optional delivery project this meeting belongs to.';

NOTIFY pgrst, 'reload schema';
