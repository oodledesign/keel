-- Partner cost lines on host projects (draft → submitted → approved/rejected).
-- Phase 3 invoicing is out of scope.

CREATE TABLE IF NOT EXISTS public.partner_project_cost_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  owner_account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  partner_account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  share_id uuid NOT NULL REFERENCES public.client_workspace_shares (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  estimate_pence integer CHECK (estimate_pence IS NULL OR estimate_pence >= 0),
  actual_pence integer CHECK (actual_pence IS NULL OR actual_pence >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text
);

CREATE INDEX IF NOT EXISTS partner_project_cost_lines_project_idx
  ON public.partner_project_cost_lines (project_id);

CREATE INDEX IF NOT EXISTS partner_project_cost_lines_share_idx
  ON public.partner_project_cost_lines (share_id);

CREATE INDEX IF NOT EXISTS partner_project_cost_lines_partner_idx
  ON public.partner_project_cost_lines (partner_account_id, status);

COMMENT ON TABLE public.partner_project_cost_lines IS
  'Partner-submitted cost sheet lines on a host project; host approves/rejects.';

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_partner_project_cost_lines_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_project_cost_lines_set_updated_at
  ON public.partner_project_cost_lines;
CREATE TRIGGER partner_project_cost_lines_set_updated_at
  BEFORE UPDATE ON public.partner_project_cost_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_partner_project_cost_lines_updated_at();

ALTER TABLE public.partner_project_cost_lines ENABLE ROW LEVEL SECURITY;

-- Partner: members of partner_account_id with active can_projects share
DROP POLICY IF EXISTS partner_project_cost_lines_select_partner
  ON public.partner_project_cost_lines;
CREATE POLICY partner_project_cost_lines_select_partner
  ON public.partner_project_cost_lines
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_on_account(partner_account_id)
    AND EXISTS (
      SELECT 1
      FROM public.client_workspace_shares s
      WHERE s.id = partner_project_cost_lines.share_id
        AND s.status = 'active'
        AND s.can_projects = true
        AND s.guest_account_id = partner_project_cost_lines.partner_account_id
        AND s.owner_account_id = partner_project_cost_lines.owner_account_id
    )
  );

DROP POLICY IF EXISTS partner_project_cost_lines_insert_partner
  ON public.partner_project_cost_lines;
CREATE POLICY partner_project_cost_lines_insert_partner
  ON public.partner_project_cost_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_account(partner_account_id)
    AND created_by = (SELECT auth.uid())
    AND status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1
      FROM public.client_workspace_shares s
      JOIN public.projects p ON p.id = partner_project_cost_lines.project_id
      LEFT JOIN public.clients c ON c.id = p.client_id
      WHERE s.id = partner_project_cost_lines.share_id
        AND s.status = 'active'
        AND s.can_projects = true
        AND s.guest_account_id = partner_project_cost_lines.partner_account_id
        AND s.owner_account_id = partner_project_cost_lines.owner_account_id
        AND p.account_id = partner_project_cost_lines.owner_account_id
        AND s.client_org_id = COALESCE(p.client_org_id, c.client_org_id)
    )
  );

DROP POLICY IF EXISTS partner_project_cost_lines_update_partner
  ON public.partner_project_cost_lines;
CREATE POLICY partner_project_cost_lines_update_partner
  ON public.partner_project_cost_lines
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_account(partner_account_id)
    AND status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1
      FROM public.client_workspace_shares s
      WHERE s.id = partner_project_cost_lines.share_id
        AND s.status = 'active'
        AND s.can_projects = true
        AND s.guest_account_id = partner_project_cost_lines.partner_account_id
    )
  )
  WITH CHECK (
    public.has_role_on_account(partner_account_id)
    AND status IN ('draft', 'submitted', 'rejected')
    AND EXISTS (
      SELECT 1
      FROM public.client_workspace_shares s
      WHERE s.id = partner_project_cost_lines.share_id
        AND s.status = 'active'
        AND s.can_projects = true
        AND s.guest_account_id = partner_project_cost_lines.partner_account_id
    )
  );

DROP POLICY IF EXISTS partner_project_cost_lines_delete_partner
  ON public.partner_project_cost_lines;
CREATE POLICY partner_project_cost_lines_delete_partner
  ON public.partner_project_cost_lines
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_account(partner_account_id)
    AND status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1
      FROM public.client_workspace_shares s
      WHERE s.id = partner_project_cost_lines.share_id
        AND s.status = 'active'
        AND s.can_projects = true
        AND s.guest_account_id = partner_project_cost_lines.partner_account_id
    )
  );

-- Host: members of owner_account_id with jobs.edit (or account manager)
DROP POLICY IF EXISTS partner_project_cost_lines_select_host
  ON public.partner_project_cost_lines;
CREATE POLICY partner_project_cost_lines_select_host
  ON public.partner_project_cost_lines
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_on_account(owner_account_id)
    AND (
      public.has_permission(auth.uid(), owner_account_id, 'jobs.edit'::public.app_permissions)
      OR public.is_account_owner(owner_account_id)
    )
  );

DROP POLICY IF EXISTS partner_project_cost_lines_update_host
  ON public.partner_project_cost_lines;
CREATE POLICY partner_project_cost_lines_update_host
  ON public.partner_project_cost_lines
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_account(owner_account_id)
    AND (
      public.has_permission(auth.uid(), owner_account_id, 'jobs.edit'::public.app_permissions)
      OR public.is_account_owner(owner_account_id)
    )
  )
  WITH CHECK (
    public.has_role_on_account(owner_account_id)
    AND (
      public.has_permission(auth.uid(), owner_account_id, 'jobs.edit'::public.app_permissions)
      OR public.is_account_owner(owner_account_id)
    )
    AND status IN ('submitted', 'approved', 'rejected')
  );

REVOKE ALL ON TABLE public.partner_project_cost_lines FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_project_cost_lines TO authenticated;
GRANT ALL ON public.partner_project_cost_lines TO service_role;

NOTIFY pgrst, 'reload schema';
