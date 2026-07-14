-- H1: Client approval audit log (current state remains on websites.sitemap JSONB)

CREATE TABLE IF NOT EXISTS public.website_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('page', 'section')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'changes_requested')),
  note text,
  actor text NOT NULL CHECK (actor IN ('client', 'agency')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_approvals IS
  'Audit trail for page/section approve and request-changes. Live status stays on websites.sitemap JSONB.';

CREATE INDEX IF NOT EXISTS ix_website_approvals_website_created
  ON public.website_approvals (website_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_website_approvals_account_created
  ON public.website_approvals (account_id, created_at DESC);

ALTER TABLE public.website_approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.website_approvals FROM authenticated, anon, service_role;
GRANT SELECT ON public.website_approvals TO authenticated;
GRANT ALL ON public.website_approvals TO service_role;

DROP POLICY IF EXISTS website_approvals_select ON public.website_approvals;
CREATE POLICY website_approvals_select ON public.website_approvals
  FOR SELECT TO authenticated
  USING (
    (
      public.has_role_on_account (account_id)
      AND NOT public.is_client_on_account (account_id)
      AND NOT public.is_contractor_on_account (account_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.websites w
      JOIN public.client_members cm ON cm.client_org_id = w.client_org_id
      WHERE w.id = website_approvals.website_id
        AND cm.user_id = auth.uid()
        AND w.portal_share_scope IN ('sitemap', 'wireframes', 'full')
    )
  );

-- Inserts go through service role (share token / portal actions use admin client).
DROP POLICY IF EXISTS website_approvals_insert_service ON public.website_approvals;
-- service_role bypasses RLS; no insert policy for authenticated clients.

NOTIFY pgrst, 'reload schema';
