-- 1. Guest permissions: allow guests with `edit_all_tasks` capability to update any task in the project.
-- 2. Guard trigger on tasks: prevent guests from changing project_id or account_id.
-- 3. Project audit log: append-only table and triggers logging changes to tasks, projects, phases, notes, and guest access.

-- ---------------------------------------------------------------------------
-- 1) Update tasks_update_as_project_guest policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_update_as_project_guest ON public.tasks;
CREATE POLICY tasks_update_as_project_guest
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      public.has_project_guest_capability(project_id, 'edit_all_tasks')
      OR (
        public.has_project_guest_capability(project_id, 'edit_own_task')
        AND user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND (
      public.has_project_guest_capability(project_id, 'edit_all_tasks')
      OR (
        public.has_project_guest_capability(project_id, 'edit_own_task')
        AND user_id = (SELECT auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Guard trigger: prevent guests from moving tasks between accounts or projects
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_project_guest_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.project_id IS NOT NULL
    AND public.is_accepted_project_guest(OLD.project_id)
    AND NOT public.can_edit_project_canvas(OLD.account_id)
    AND (
      NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.account_id IS DISTINCT FROM OLD.account_id
    )
  THEN
    RAISE EXCEPTION 'Guests cannot move this task to another project or account'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_project_guest_task_update() FROM public;

DROP TRIGGER IF EXISTS guard_guest_task_update ON public.tasks;
CREATE TRIGGER guard_guest_task_update
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_guest_task_update();

-- ---------------------------------------------------------------------------
-- 3) Project audit log table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'project', 'phase', 'note', 'guest')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  summary text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_audit_log IS
  'Append-only audit trail of changes to projects, tasks, phases, canvas notes and guest access.';

CREATE INDEX IF NOT EXISTS ix_project_audit_log_account_created
  ON public.project_audit_log (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_project_audit_log_project_created
  ON public.project_audit_log (project_id, created_at DESC);

ALTER TABLE public.project_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_audit_log FROM authenticated, service_role;
GRANT SELECT ON public.project_audit_log TO authenticated;
GRANT ALL ON public.project_audit_log TO service_role;

DROP POLICY IF EXISTS project_audit_log_select ON public.project_audit_log;
CREATE POLICY project_audit_log_select
  ON public.project_audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
    OR public.has_permission((SELECT auth.uid()), account_id, 'jobs.edit'::public.app_permissions)
  );

-- ---------------------------------------------------------------------------
-- 4) Trigger function: automatically capture audit events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_project_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
  v_project_id uuid;
  v_actor_id uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_action text;
  v_summary text;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  v_actor_id := (SELECT auth.uid());

  IF TG_TABLE_NAME = 'tasks' THEN
    v_entity_type := 'task';
    IF TG_OP = 'INSERT' THEN
      IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
      v_account_id := NEW.account_id;
      v_project_id := NEW.project_id;
      v_entity_id := NEW.id;
      v_action := 'created';
      v_summary := 'Task "' || COALESCE(NEW.title, 'Untitled') || '" created';
      v_changes := jsonb_build_object(
        'title', jsonb_build_object('new', NEW.title),
        'status', jsonb_build_object('new', NEW.status),
        'priority', jsonb_build_object('new', NEW.priority)
      );
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.project_id IS NULL THEN RETURN OLD; END IF;
      v_account_id := OLD.account_id;
      v_project_id := OLD.project_id;
      v_entity_id := OLD.id;
      v_action := 'deleted';
      v_summary := 'Task "' || COALESCE(OLD.title, 'Untitled') || '" deleted';
      v_changes := jsonb_build_object(
        'title', jsonb_build_object('old', OLD.title),
        'status', jsonb_build_object('old', OLD.status)
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.project_id IS NULL AND OLD.project_id IS NULL THEN RETURN NEW; END IF;
      v_account_id := COALESCE(NEW.account_id, OLD.account_id);
      v_project_id := COALESCE(NEW.project_id, OLD.project_id);
      v_entity_id := NEW.id;
      v_action := 'updated';

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        v_summary := 'Task "' || NEW.title || '" moved from ' || OLD.status || ' to ' || NEW.status;
      END IF;
      IF NEW.title IS DISTINCT FROM OLD.title THEN
        v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
        IF v_summary IS NULL THEN
          v_summary := 'Task renamed from "' || OLD.title || '" to "' || NEW.title || '"';
        END IF;
      END IF;
      IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
        v_changes := v_changes || jsonb_build_object('due_date', jsonb_build_object('old', OLD.due_date, 'new', NEW.due_date));
        IF v_summary IS NULL THEN
          v_summary := 'Task "' || NEW.title || '" due date set to ' || COALESCE(to_char(NEW.due_date, 'YYYY-MM-DD'), 'none');
        END IF;
      END IF;
      IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
        IF v_summary IS NULL THEN
          v_summary := 'Task "' || NEW.title || '" priority changed to ' || NEW.priority;
        END IF;
      END IF;
      IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.assignee_contact_id IS DISTINCT FROM OLD.assignee_contact_id THEN
        v_changes := v_changes || jsonb_build_object('assignee', jsonb_build_object('old', OLD.user_id, 'new', NEW.user_id));
        IF v_summary IS NULL THEN
          v_summary := 'Task "' || NEW.title || '" assignee updated';
        END IF;
      END IF;
      IF NEW.phase_id IS DISTINCT FROM OLD.phase_id THEN
        v_changes := v_changes || jsonb_build_object('phase_id', jsonb_build_object('old', OLD.phase_id, 'new', NEW.phase_id));
        IF v_summary IS NULL THEN
          v_summary := 'Task "' || NEW.title || '" phase updated';
        END IF;
      END IF;
      IF NEW.notes IS DISTINCT FROM OLD.notes THEN
        v_changes := v_changes || jsonb_build_object('notes', jsonb_build_object('updated', true));
        IF v_summary IS NULL THEN
          v_summary := 'Task "' || NEW.title || '" notes edited';
        END IF;
      END IF;

      IF v_changes = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      IF v_summary IS NULL THEN
        v_summary := 'Task "' || NEW.title || '" updated';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'projects' THEN
    v_entity_type := 'project';
    IF TG_OP = 'UPDATE' THEN
      v_account_id := NEW.account_id;
      v_project_id := NEW.id;
      v_entity_id := NEW.id;
      v_action := 'updated';

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        v_summary := 'Project status changed to ' || NEW.status;
      END IF;
      IF NEW.name IS DISTINCT FROM OLD.name OR NEW.title IS DISTINCT FROM OLD.title THEN
        v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', COALESCE(OLD.title, OLD.name), 'new', COALESCE(NEW.title, NEW.name)));
        IF v_summary IS NULL THEN
          v_summary := 'Project renamed to "' || COALESCE(NEW.title, NEW.name) || '"';
        END IF;
      END IF;
      IF NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.start_date IS DISTINCT FROM OLD.start_date THEN
        v_changes := v_changes || jsonb_build_object('dates', jsonb_build_object('start_date', NEW.start_date, 'due_date', NEW.due_date));
        IF v_summary IS NULL THEN
          v_summary := 'Project dates updated';
        END IF;
      END IF;
      IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
        IF v_summary IS NULL THEN
          v_summary := 'Project priority set to ' || NEW.priority;
        END IF;
      END IF;
      IF NEW.description IS DISTINCT FROM OLD.description THEN
        v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('updated', true));
        IF v_summary IS NULL THEN
          v_summary := 'Project description updated';
        END IF;
      END IF;

      IF v_changes = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      IF v_summary IS NULL THEN
        v_summary := 'Project details updated';
      END IF;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'project_phases' THEN
    v_entity_type := 'phase';
    IF TG_OP = 'INSERT' THEN
      v_account_id := NEW.account_id;
      v_project_id := NEW.project_id;
      v_entity_id := NEW.id;
      v_action := 'created';
      v_summary := 'Phase "' || NEW.name || '" created';
      v_changes := jsonb_build_object('name', NEW.name, 'status', NEW.status);
    ELSIF TG_OP = 'DELETE' THEN
      v_account_id := OLD.account_id;
      v_project_id := OLD.project_id;
      v_entity_id := OLD.id;
      v_action := 'deleted';
      v_summary := 'Phase "' || OLD.name || '" deleted';
      v_changes := jsonb_build_object('name', OLD.name);
    ELSIF TG_OP = 'UPDATE' THEN
      v_account_id := NEW.account_id;
      v_project_id := NEW.project_id;
      v_entity_id := NEW.id;
      v_action := 'updated';

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        v_summary := 'Phase "' || NEW.name || '" status changed to ' || NEW.status;
      END IF;
      IF NEW.name IS DISTINCT FROM OLD.name THEN
        v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        IF v_summary IS NULL THEN
          v_summary := 'Phase renamed from "' || OLD.name || '" to "' || NEW.name || '"';
        END IF;
      END IF;
      IF NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.start_date IS DISTINCT FROM OLD.start_date THEN
        v_changes := v_changes || jsonb_build_object('dates', jsonb_build_object('start_date', NEW.start_date, 'due_date', NEW.due_date));
        IF v_summary IS NULL THEN
          v_summary := 'Phase "' || NEW.name || '" dates updated';
        END IF;
      END IF;

      IF v_changes = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      IF v_summary IS NULL THEN
        v_summary := 'Phase "' || NEW.name || '" updated';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'notes' THEN
    v_entity_type := 'note';
    IF TG_OP = 'INSERT' THEN
      IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
      v_account_id := NEW.account_id;
      v_project_id := NEW.project_id;
      v_entity_id := NEW.id;
      v_action := 'created';
      v_summary := 'Note "' || COALESCE(NULLIF(NEW.title, ''), 'Untitled') || '" created';
      v_changes := jsonb_build_object('title', NEW.title);
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.project_id IS NULL THEN RETURN OLD; END IF;
      v_account_id := OLD.account_id;
      v_project_id := OLD.project_id;
      v_entity_id := OLD.id;
      v_action := 'deleted';
      v_summary := 'Note "' || COALESCE(NULLIF(OLD.title, ''), 'Untitled') || '" deleted';
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.project_id IS NULL AND OLD.project_id IS NULL THEN RETURN NEW; END IF;
      v_account_id := COALESCE(NEW.account_id, OLD.account_id);
      v_project_id := COALESCE(NEW.project_id, OLD.project_id);
      v_entity_id := NEW.id;
      v_action := 'updated';

      IF NEW.title IS DISTINCT FROM OLD.title THEN
        v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
      END IF;
      IF NEW.content IS DISTINCT FROM OLD.content THEN
        v_changes := v_changes || jsonb_build_object('content', jsonb_build_object('updated', true));
      END IF;

      IF v_changes = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      v_summary := 'Note "' || COALESCE(NULLIF(NEW.title, ''), 'Untitled') || '" edited';
    END IF;

  ELSIF TG_TABLE_NAME = 'project_guests' THEN
    v_entity_type := 'guest';
    IF TG_OP = 'INSERT' THEN
      v_account_id := NEW.account_id;
      v_project_id := NEW.project_id;
      v_entity_id := NEW.id;
      v_action := 'created';
      v_summary := 'Guest ' || NEW.invited_email || ' invited';
      v_changes := jsonb_build_object('email', NEW.invited_email, 'permissions', NEW.permissions);
    ELSIF TG_OP = 'DELETE' THEN
      v_account_id := OLD.account_id;
      v_project_id := OLD.project_id;
      v_entity_id := OLD.id;
      v_action := 'deleted';
      v_summary := 'Guest ' || OLD.invited_email || ' invite removed';
    ELSIF TG_OP = 'UPDATE' THEN
      v_account_id := NEW.account_id;
      v_project_id := NEW.project_id;
      v_entity_id := NEW.id;
      v_action := 'updated';

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        v_summary := 'Guest ' || NEW.invited_email || ' ' || NEW.status;
      END IF;
      IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
        v_changes := v_changes || jsonb_build_object('permissions', jsonb_build_object('old', OLD.permissions, 'new', NEW.permissions));
        IF v_summary IS NULL THEN
          v_summary := 'Guest ' || NEW.invited_email || ' permissions updated';
        END IF;
      END IF;

      IF v_changes = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      IF v_summary IS NULL THEN
        v_summary := 'Guest ' || NEW.invited_email || ' updated';
      END IF;
    END IF;
  END IF;

  IF v_account_id IS NOT NULL AND v_project_id IS NOT NULL AND v_summary IS NOT NULL THEN
    INSERT INTO public.project_audit_log (
      account_id,
      project_id,
      actor_user_id,
      entity_type,
      entity_id,
      action,
      summary,
      changes
    ) VALUES (
      v_account_id,
      v_project_id,
      v_actor_id,
      v_entity_type,
      v_entity_id,
      v_action,
      v_summary,
      v_changes
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_project_audit_event failed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_project_audit_event() FROM public;

DROP TRIGGER IF EXISTS log_tasks_audit ON public.tasks;
CREATE TRIGGER log_tasks_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_event();

DROP TRIGGER IF EXISTS log_projects_audit ON public.projects;
CREATE TRIGGER log_projects_audit
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_event();

DROP TRIGGER IF EXISTS log_project_phases_audit ON public.project_phases;
CREATE TRIGGER log_project_phases_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_event();

DROP TRIGGER IF EXISTS log_notes_audit ON public.notes;
CREATE TRIGGER log_notes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_event();

DROP TRIGGER IF EXISTS log_project_guests_audit ON public.project_guests;
CREATE TRIGGER log_project_guests_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.project_guests
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_event();
