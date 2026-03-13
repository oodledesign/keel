-- CRM V1: client_notes table + projects.client_id for job history
-- Notes: Owner/Admin/Staff only (clients.edit). Contractors have no access to notes.
-- Job history: projects.client_id links a project to a client (many projects per client).

-- 1) Add client_id to projects (for job history: list projects linked to a client)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_projects_client_id ON public.projects(client_id);
COMMENT ON COLUMN public.projects.client_id IS 'Optional link to client for job history (CRM V1).';

-- 2) Client notes: internal only; Owner/Admin/Staff can create/list/delete; contractors cannot access
CREATE TABLE IF NOT EXISTS public.client_notes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.client_notes IS 'Internal notes on clients. Owner/Admin/Staff only; contractors have no access (CRM V1).';
CREATE INDEX IF NOT EXISTS ix_client_notes_account_id ON public.client_notes(account_id);
CREATE INDEX IF NOT EXISTS ix_client_notes_client_id ON public.client_notes(client_id);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- client_notes: SELECT/INSERT/DELETE only for users with clients.edit (Owner, Admin, Staff; no Contractor)
CREATE POLICY client_notes_select ON public.client_notes FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

CREATE POLICY client_notes_insert ON public.client_notes FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

CREATE POLICY client_notes_delete ON public.client_notes FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

-- No UPDATE policy: V1 is create/list/delete only
GRANT SELECT, INSERT, DELETE ON public.client_notes TO authenticated;

-- 3) Update clients SELECT so contractors can see a client when assigned to any project linked to that client (projects.client_id)
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR (project_id IS NOT NULL AND public.contractor_assigned_to_project(project_id))
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.client_id = public.clients.id
        AND public.contractor_assigned_to_project(p.id)
    )
  )
);
