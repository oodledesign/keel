-- Client portal access to individual meetings. A meeting becomes visible in
-- the client portal when its owner flips `portal_visible` on and the meeting
-- is linked (via client_id -> clients.client_org_id) to the same client_org
-- the portal contact belongs to. Read-only: summary, transcript, and accepted
-- action items — separate from anonymous public_share_token links.

ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS portal_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meeting_transcripts.portal_visible IS
  'When true, client portal contacts for the linked client_org can view this meeting (summary, transcript, accepted tasks).';

CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_portal_visible
  ON public.meeting_transcripts (client_id)
  WHERE portal_visible = true AND client_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Eligibility helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_portal_visible_meeting(target_transcript_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_transcripts mt
    JOIN public.clients c ON c.id = mt.client_id
    JOIN public.client_members cm ON cm.client_org_id = c.client_org_id
    WHERE mt.id = target_transcript_id
      AND mt.portal_visible = true
      AND mt.client_id IS NOT NULL
      AND c.client_org_id IS NOT NULL
      AND cm.user_id = (SELECT auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_portal_visible_meeting(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: additive SELECT only for portal members
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS meeting_transcripts_select_client_portal ON public.meeting_transcripts;
CREATE POLICY meeting_transcripts_select_client_portal
  ON public.meeting_transcripts
  FOR SELECT
  TO authenticated
  USING (public.is_portal_visible_meeting(id));

DROP POLICY IF EXISTS meeting_summaries_select_client_portal ON public.meeting_summaries;
CREATE POLICY meeting_summaries_select_client_portal
  ON public.meeting_summaries
  FOR SELECT
  TO authenticated
  USING (public.is_portal_visible_meeting(meeting_transcript_id));

DROP POLICY IF EXISTS meeting_action_items_select_client_portal ON public.meeting_action_items;
CREATE POLICY meeting_action_items_select_client_portal
  ON public.meeting_action_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_portal_visible_meeting(meeting_transcript_id)
    AND status IN ('approved', 'auto_published')
  );

NOTIFY pgrst, 'reload schema';
