-- Part C Task 1: AI-generated meeting summaries for recap emails and task extraction context.

CREATE TABLE IF NOT EXISTS public.meeting_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_transcript_id uuid NOT NULL REFERENCES public.meeting_transcripts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  summary_text text NOT NULL DEFAULT '',
  attendee_emails text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_summaries_transcript_key UNIQUE (meeting_transcript_id)
);

CREATE INDEX IF NOT EXISTS ix_meeting_summaries_account_id
  ON public.meeting_summaries (account_id, generated_at DESC);

COMMENT ON TABLE public.meeting_summaries IS
  'AI-written meeting overview generated when a desktop recorder transcript syncs.';

COMMENT ON COLUMN public.meeting_summaries.attendee_emails IS
  'Verified attendee emails copied from calendar metadata at generation time.';

ALTER TABLE public.meeting_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_summaries_select ON public.meeting_summaries;
DROP POLICY IF EXISTS meeting_summaries_insert ON public.meeting_summaries;
DROP POLICY IF EXISTS meeting_summaries_update ON public.meeting_summaries;
DROP POLICY IF EXISTS meeting_summaries_delete ON public.meeting_summaries;

CREATE POLICY meeting_summaries_select ON public.meeting_summaries FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY meeting_summaries_insert ON public.meeting_summaries FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY meeting_summaries_update ON public.meeting_summaries FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY meeting_summaries_delete ON public.meeting_summaries FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_summaries TO authenticated, service_role;
