-- Project guests: external collaborators scoped to a single project (not account
-- members, not client_workspace_shares). Intentionally grants NO access to
-- client_orgs, accounts, invoices, or other finance tables — do not "fix" that
-- by adding guest policies on those tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- project_guests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{"comment": true, "create_task": true, "edit_own_task": true}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  invite_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT project_guests_project_email_unique UNIQUE (project_id, invited_email),
  CONSTRAINT project_guests_invite_token_unique UNIQUE (invite_token)
);

COMMENT ON TABLE public.project_guests IS
  'External guest access to a single project task board. Narrower than client_workspace_shares.';

CREATE INDEX IF NOT EXISTS ix_project_guests_account_id
  ON public.project_guests (account_id);

CREATE INDEX IF NOT EXISTS ix_project_guests_user_accepted
  ON public.project_guests (user_id)
  WHERE status = 'accepted' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_project_guests_project_status
  ON public.project_guests (project_id, status);

CREATE INDEX IF NOT EXISTS ix_project_guests_invite_token
  ON public.project_guests (invite_token);

-- Denormalise account_id from projects when missing / keep in sync on insert/update.
CREATE OR REPLACE FUNCTION public.project_guests_set_account_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  project_account uuid;
BEGIN
  SELECT p.account_id INTO project_account
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF project_account IS NULL THEN
    RAISE EXCEPTION 'project_guests: project % has no account_id', NEW.project_id;
  END IF;

  NEW.account_id := project_account;
  NEW.invited_email := lower(trim(NEW.invited_email));

  IF NEW.invite_token IS NULL OR length(trim(NEW.invite_token)) = 0 THEN
    NEW.invite_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_guests_set_account_id ON public.project_guests;
CREATE TRIGGER project_guests_set_account_id
  BEFORE INSERT OR UPDATE OF project_id ON public.project_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.project_guests_set_account_id();

-- ---------------------------------------------------------------------------
-- task_comments (guest "comment" capability surface)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.task_comments IS
  'Threaded comments on tasks. Used by project guests and team members.';

CREATE INDEX IF NOT EXISTS ix_task_comments_task_id
  ON public.task_comments (task_id, created_at);

CREATE INDEX IF NOT EXISTS ix_task_comments_project_id
  ON public.task_comments (project_id);

CREATE OR REPLACE FUNCTION public.task_comments_set_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t_project uuid;
  t_account uuid;
BEGIN
  SELECT t.project_id, COALESCE(t.account_id, p.account_id)
  INTO t_project, t_account
  FROM public.tasks t
  LEFT JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = NEW.task_id;

  IF t_project IS NULL THEN
    RAISE EXCEPTION 'task_comments: task % has no project_id', NEW.task_id;
  END IF;

  NEW.project_id := t_project;
  NEW.account_id := t_account;

  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'task_comments: could not resolve account_id for task %', NEW.task_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_set_context ON public.task_comments;
CREATE TRIGGER task_comments_set_context
  BEFORE INSERT OR UPDATE OF task_id ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.task_comments_set_context();

-- ---------------------------------------------------------------------------
-- Sibling helpers (do NOT overload has_permission — guest keys are jsonb, not enum)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_accepted_project_guest(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_guests g
    WHERE g.project_id = target_project_id
      AND g.user_id = (SELECT auth.uid())
      AND g.status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_guest_capability(
  target_project_id uuid,
  capability_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_guests g
    WHERE g.project_id = target_project_id
      AND g.user_id = (SELECT auth.uid())
      AND g.status = 'accepted'
      AND COALESCE((g.permissions ->> capability_key)::boolean, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_guest_on_account(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_guests g
    WHERE g.account_id = target_account_id
      AND g.user_id = (SELECT auth.uid())
      AND g.status = 'accepted'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_accepted_project_guest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_project_guest_capability(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_guest_on_account(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: project_guests
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_guests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_guests FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.project_guests TO authenticated;
GRANT ALL ON public.project_guests TO service_role;

DROP POLICY IF EXISTS project_guests_select ON public.project_guests;
CREATE POLICY project_guests_select
  ON public.project_guests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_on_account(account_id)
    OR (user_id IS NOT NULL AND user_id = (SELECT auth.uid()))
    OR lower(invited_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
  );

DROP POLICY IF EXISTS project_guests_insert ON public.project_guests;
CREATE POLICY project_guests_insert
  ON public.project_guests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  );

DROP POLICY IF EXISTS project_guests_update ON public.project_guests;
CREATE POLICY project_guests_update
  ON public.project_guests
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  )
  WITH CHECK (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  );

-- Soft-revoke only — no DELETE policy for authenticated (audit trail).

-- ---------------------------------------------------------------------------
-- RLS: projects — additive guest SELECT only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS projects_select_as_guest ON public.projects;
CREATE POLICY projects_select_as_guest
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.is_accepted_project_guest(id));

-- ---------------------------------------------------------------------------
-- RLS: tasks — additive guest policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_select_as_project_guest ON public.tasks;
CREATE POLICY tasks_select_as_project_guest
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.is_accepted_project_guest(project_id)
  );

DROP POLICY IF EXISTS tasks_insert_as_project_guest ON public.tasks;
CREATE POLICY tasks_insert_as_project_guest
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NOT NULL
    AND public.has_project_guest_capability(project_id, 'create_task')
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS tasks_update_as_project_guest ON public.tasks;
CREATE POLICY tasks_update_as_project_guest
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.has_project_guest_capability(project_id, 'edit_own_task')
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND public.has_project_guest_capability(project_id, 'edit_own_task')
    AND user_id = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: task_comments
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.task_comments FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
CREATE POLICY task_comments_select
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_on_account(account_id)
    OR public.is_accepted_project_guest(project_id)
  );

DROP POLICY IF EXISTS task_comments_insert ON public.task_comments;
CREATE POLICY task_comments_insert
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (
      public.has_role_on_account(account_id)
      OR public.has_project_guest_capability(project_id, 'comment')
    )
  );

DROP POLICY IF EXISTS task_comments_update ON public.task_comments;
CREATE POLICY task_comments_update
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    OR public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;
CREATE POLICY task_comments_delete
  ON public.task_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
  );

-- Intentionally NO policies granting project_guests access to:
-- client_orgs, clients, accounts, invoices, or other finance tables.

NOTIFY pgrst, 'reload schema';
