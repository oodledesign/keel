-- Portal service-request drafts.
-- support_tickets.status has no draft value (open | in-progress | waiting |
-- resolved | closed, plus app-level pending_credits). A draft must not land
-- in the agency queue or notify the workspace, so it lives in its own table.

CREATE TABLE IF NOT EXISTS public.portal_request_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id uuid NOT NULL REFERENCES public.client_orgs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  step_index integer NOT NULL DEFAULT 1 CHECK (step_index BETWEEN 1 AND 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_request_drafts_user_org_unique UNIQUE (client_org_id, user_id),
  CONSTRAINT portal_request_drafts_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.portal_request_drafts IS
  'One in-progress portal service/support request per client member. Not a support ticket until submit.';

CREATE INDEX IF NOT EXISTS ix_portal_request_drafts_user
  ON public.portal_request_drafts (user_id);

DROP TRIGGER IF EXISTS portal_request_drafts_set_timestamps
  ON public.portal_request_drafts;
CREATE TRIGGER portal_request_drafts_set_timestamps
  BEFORE UPDATE ON public.portal_request_drafts
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.portal_request_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.portal_request_drafts FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_request_drafts TO authenticated;
GRANT ALL ON public.portal_request_drafts TO service_role;

DROP POLICY IF EXISTS portal_request_drafts_own ON public.portal_request_drafts;
CREATE POLICY portal_request_drafts_own
  ON public.portal_request_drafts
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = portal_request_drafts.client_org_id
        AND cm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = portal_request_drafts.client_org_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
