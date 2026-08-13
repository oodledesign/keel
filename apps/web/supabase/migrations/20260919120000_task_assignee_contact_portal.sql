-- Assign tasks to CRM contacts; portal users matched by email can see and
-- mark those tasks complete (status only).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_contact_id uuid
    REFERENCES public.contacts (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.assignee_contact_id IS
  'CRM contact responsible for this task (external assignee). When set, the contact can see the task in the client portal My tasks list.';

CREATE INDEX IF NOT EXISTS ix_tasks_assignee_contact_id
  ON public.tasks (account_id, assignee_contact_id)
  WHERE assignee_contact_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Portal eligibility: auth user email matches the assigned contact, and the
-- contact is linked to a client_org the user belongs to via client_members.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_portal_assigned_task(target_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.contacts ct ON ct.id = t.assignee_contact_id
    JOIN public.client_contacts cc ON cc.contact_id = ct.id
    JOIN public.clients c ON c.id = cc.client_id AND c.client_org_id IS NOT NULL
    JOIN public.client_members cm ON cm.client_org_id = c.client_org_id
    JOIN auth.users u ON u.id = cm.user_id
    WHERE t.id = target_task_id
      AND t.assignee_contact_id IS NOT NULL
      AND cm.user_id = (SELECT auth.uid())
      AND ct.email IS NOT NULL
      AND u.email IS NOT NULL
      AND lower(trim(ct.email)) = lower(trim(u.email))
  );
$$;

COMMENT ON FUNCTION public.is_portal_assigned_task(uuid) IS
  'True when the current portal user is the CRM contact assigned to the task (email match within their client_org).';

GRANT EXECUTE ON FUNCTION public.is_portal_assigned_task(uuid) TO authenticated, service_role;

-- SELECT: portal-visible project tasks OR contact-assigned tasks
DROP POLICY IF EXISTS tasks_select_client_portal ON public.tasks;
CREATE POLICY tasks_select_client_portal
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    (
      project_id IS NOT NULL
      AND public.is_portal_visible_project(project_id)
    )
    OR public.is_portal_assigned_task(id)
  );

-- UPDATE: portal assignee may change status (app only writes status; guard below)
DROP POLICY IF EXISTS tasks_update_client_portal_assignee ON public.tasks;
CREATE POLICY tasks_update_client_portal_assignee
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (public.is_portal_assigned_task(id))
  WITH CHECK (public.is_portal_assigned_task(id));

-- Guard: portal assignees may only change status / updated_at
CREATE OR REPLACE FUNCTION public.tasks_portal_assignee_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Workspace members keep full update rights via other policies; only
  -- constrain rows updated solely through the portal-assignee path.
  IF NEW.account_id IS NOT NULL
    AND public.has_role_on_account(NEW.account_id)
  THEN
    RETURN NEW;
  END IF;

  IF public.is_portal_assigned_task(OLD.id) THEN
    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.phase_id IS DISTINCT FROM OLD.phase_id
      OR NEW.parent_task_id IS DISTINCT FROM OLD.parent_task_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.assignee_contact_id IS DISTINCT FROM OLD.assignee_contact_id
      OR NEW.account_id IS DISTINCT FROM OLD.account_id
      OR NEW.area_id IS DISTINCT FROM OLD.area_id
    THEN
      RAISE EXCEPTION 'Portal assignees may only update task status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_portal_assignee_update_guard ON public.tasks;
CREATE TRIGGER tasks_portal_assignee_update_guard
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_portal_assignee_update_guard();

NOTIFY pgrst, 'reload schema';
