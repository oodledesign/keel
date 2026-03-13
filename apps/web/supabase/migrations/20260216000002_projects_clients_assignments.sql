-- Projects, clients, and project_assignments with RLS for contractor scoping
-- Contractors: access only to projects they are assigned to; read-only access to clients from those projects.

-- 1) Helper: is the current user a contractor on this account?
CREATE OR REPLACE FUNCTION public.is_contractor_on_account(account_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships
    WHERE accounts_memberships.account_id = is_contractor_on_account.account_id
      AND accounts_memberships.user_id = auth.uid()
      AND accounts_memberships.account_role = 'contractor'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_contractor_on_account(uuid) TO authenticated;

-- 2) Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.projects IS 'Projects belong to an account. Contractors see only projects they are assigned to.';
CREATE INDEX IF NOT EXISTS ix_projects_account_id ON public.projects(account_id);

-- 3) Project assignments (which users are assigned to which projects) — must exist before contractor_assigned_to_project
CREATE TABLE IF NOT EXISTS public.project_assignments (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);
COMMENT ON TABLE public.project_assignments IS 'Assigns users (e.g. contractors) to projects. Used to scope contractor access.';
CREATE INDEX IF NOT EXISTS ix_project_assignments_user_id ON public.project_assignments(user_id);

-- 4) Helper: is the current user assigned to this project?
CREATE OR REPLACE FUNCTION public.contractor_assigned_to_project(project_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_assignments.project_id = contractor_assigned_to_project.project_id
      AND project_assignments.user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_project(uuid) TO authenticated;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects: SELECT — account members; contractors only if assigned
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR public.contractor_assigned_to_project(id)
  )
);

-- Projects: INSERT — only non-contractors with projects.edit (contractors cannot create projects)
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'projects.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

-- Projects: UPDATE/DELETE — projects.edit; contractors only on assigned projects
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'projects.edit'::public.app_permissions)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR public.contractor_assigned_to_project(id)
  )
);
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'projects.edit'::public.app_permissions)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR public.contractor_assigned_to_project(id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Project assignments: SELECT if you can see the project
CREATE POLICY project_assignments_select ON public.project_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_assignments.project_id
      AND public.has_role_on_account(p.account_id)
      AND (
        NOT public.is_contractor_on_account(p.account_id)
        OR public.contractor_assigned_to_project(p.id)
      )
  )
);

-- Project assignments: INSERT/DELETE only with projects.edit (get account via project)
CREATE POLICY project_assignments_insert ON public.project_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_assignments.project_id
      AND public.has_permission(auth.uid(), p.account_id, 'projects.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(p.account_id)
  )
);
CREATE POLICY project_assignments_delete ON public.project_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_assignments.project_id
      AND public.has_permission(auth.uid(), p.account_id, 'projects.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(p.account_id)
  )
);

GRANT SELECT, INSERT, DELETE ON public.project_assignments TO authenticated;

-- 5) Clients table (linked to account and optionally to a project for contractor scoping)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.clients IS 'Clients belong to an account; project_id links to a project. Contractors have read-only access to clients from projects they are assigned to.';
CREATE INDEX IF NOT EXISTS ix_clients_account_id ON public.clients(account_id);
CREATE INDEX IF NOT EXISTS ix_clients_project_id ON public.clients(project_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Clients: SELECT — account members; contractors only for clients from projects they are assigned to
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR (project_id IS NOT NULL AND public.contractor_assigned_to_project(project_id))
  )
);

-- Clients: INSERT/UPDATE/DELETE — require clients.edit (contractors have only clients.view)
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
