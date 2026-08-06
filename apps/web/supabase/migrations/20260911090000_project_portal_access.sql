-- Client portal access to individual projects. A project becomes visible in
-- the client portal (overview + read-only tasks + commenting) when its owner
-- explicitly flips `portal_visible` on, and the project is linked (via
-- client_id -> clients.client_org_id) to the same client_org the portal
-- contact belongs to. This is intentionally narrower than project_guests:
-- read-only task visibility, comment-only write access, no task create/edit.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS portal_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.portal_visible IS
  'When true, client portal contacts for the linked client_org can view this project, its tasks, and comment via task_comments.';

CREATE INDEX IF NOT EXISTS ix_projects_portal_visible
  ON public.projects (client_id)
  WHERE portal_visible = true;

-- ---------------------------------------------------------------------------
-- Eligibility helper (mirrors is_accepted_project_guest from project_guests)
-- ---------------------------------------------------------------------------

-- projects.client_org_id is a legacy/partial column (not kept in sync with
-- client_id by any trigger) so resolve the client_org via COALESCE of the
-- direct column and the client_id -> clients.client_org_id link.
CREATE OR REPLACE FUNCTION public.is_portal_visible_project(target_project_id uuid)
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
    JOIN public.client_members cm
      ON cm.client_org_id = COALESCE(p.client_org_id, c.client_org_id)
    WHERE p.id = target_project_id
      AND p.portal_visible = true
      AND cm.user_id = (SELECT auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_portal_visible_project(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: additive, client-portal-scoped SELECT/comment policies only.
-- Does not touch existing project_guests_* policies. No access is granted to
-- client_orgs, accounts, invoices, or other finance tables via this path.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS projects_select_client_portal ON public.projects;
CREATE POLICY projects_select_client_portal
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.is_portal_visible_project(id));

DROP POLICY IF EXISTS tasks_select_client_portal ON public.tasks;
CREATE POLICY tasks_select_client_portal
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.is_portal_visible_project(project_id)
  );

-- No tasks_insert/tasks_update policy for the portal: the task list is
-- read-only for client contacts, matching the approved scope.

DROP POLICY IF EXISTS task_comments_select_client_portal ON public.task_comments;
CREATE POLICY task_comments_select_client_portal
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (public.is_portal_visible_project(project_id));

DROP POLICY IF EXISTS task_comments_insert_client_portal ON public.task_comments;
CREATE POLICY task_comments_insert_client_portal
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.is_portal_visible_project(project_id)
  );

DROP POLICY IF EXISTS task_comments_update_client_portal ON public.task_comments;
CREATE POLICY task_comments_update_client_portal
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    AND public.is_portal_visible_project(project_id)
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.is_portal_visible_project(project_id)
  );

-- No delete policy for client-portal comment authors — deletion stays
-- workspace-only, same asymmetry as project_guests.

NOTIFY pgrst, 'reload schema';
