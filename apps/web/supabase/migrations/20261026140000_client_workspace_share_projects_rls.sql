-- Partner workspace access to host projects when client_workspace_shares.can_projects
-- is true. Additive RLS only — mirrors project_guests / portal patterns.

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_client_workspace_project_access(
  target_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    LEFT JOIN public.clients c ON c.id = p.client_id
    JOIN public.client_workspace_shares s
      ON s.client_org_id = COALESCE(p.client_org_id, c.client_org_id)
     AND s.owner_account_id = p.account_id
    WHERE p.id = target_project_id
      AND s.status = 'active'
      AND s.can_projects = true
      AND s.guest_account_id IS NOT NULL
      AND public.has_role_on_account(s.guest_account_id)
  );
$$;

COMMENT ON FUNCTION public.has_client_workspace_project_access(uuid) IS
  'True when the current user is a member of a guest workspace with an active can_projects share for this project''s client_org.';

GRANT EXECUTE ON FUNCTION public.has_client_workspace_project_access(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS projects_select_via_client_workspace_share ON public.projects;
CREATE POLICY projects_select_via_client_workspace_share
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.has_client_workspace_project_access(id));

-- ---------------------------------------------------------------------------
-- tasks (view all on shared project; create/edit own only)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_select_via_client_workspace_share ON public.tasks;
CREATE POLICY tasks_select_via_client_workspace_share
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.has_client_workspace_project_access(project_id)
  );

DROP POLICY IF EXISTS tasks_insert_via_client_workspace_share ON public.tasks;
CREATE POLICY tasks_insert_via_client_workspace_share
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NOT NULL
    AND public.has_client_workspace_project_access(project_id)
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS tasks_update_via_client_workspace_share ON public.tasks;
CREATE POLICY tasks_update_via_client_workspace_share
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.has_client_workspace_project_access(project_id)
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND public.has_client_workspace_project_access(project_id)
    AND user_id = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS task_comments_select_via_client_workspace_share
  ON public.task_comments;
CREATE POLICY task_comments_select_via_client_workspace_share
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (public.has_client_workspace_project_access(project_id));

DROP POLICY IF EXISTS task_comments_insert_via_client_workspace_share
  ON public.task_comments;
CREATE POLICY task_comments_insert_via_client_workspace_share
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.has_client_workspace_project_access(project_id)
  );

-- ---------------------------------------------------------------------------
-- clients (read-only labels for linked client on shared projects)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS clients_select_via_client_workspace_share ON public.clients;
CREATE POLICY clients_select_via_client_workspace_share
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_workspace_shares s
      WHERE s.client_org_id = clients.client_org_id
        AND s.status = 'active'
        AND s.can_projects = true
        AND s.guest_account_id IS NOT NULL
        AND public.has_role_on_account(s.guest_account_id)
    )
  );

-- ---------------------------------------------------------------------------
-- project_phases (read-only when partner can see the project)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS project_phases_select_via_client_workspace_share
  ON public.project_phases;
CREATE POLICY project_phases_select_via_client_workspace_share
  ON public.project_phases
  FOR SELECT
  TO authenticated
  USING (public.has_client_workspace_project_access(project_id));

NOTIFY pgrst, 'reload schema';
