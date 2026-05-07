-- Widen tasks RLS so workspace members can read tasks linked to projects
-- in accounts they belong to (covers family/homegroup shared projects).
-- Without this, other family members' tasks in shared projects are invisible.
--
-- Only applies if public.tasks already exists (local vs prod safety check).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    RETURN;
  END IF;

  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tasks' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Drop old single-column policies if they exist
  DROP POLICY IF EXISTS tasks_select ON public.tasks;
  DROP POLICY IF EXISTS tasks_insert ON public.tasks;
  DROP POLICY IF EXISTS tasks_update ON public.tasks;
  DROP POLICY IF EXISTS tasks_delete ON public.tasks;

  -- SELECT: own tasks OR tasks in workspace projects the user is a member of
  CREATE POLICY tasks_select ON public.tasks
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.projects p
          JOIN public.accounts_memberships am ON am.account_id = p.account_id
          WHERE p.id = tasks.project_id
            AND am.user_id = auth.uid()
        )
      )
    );

  -- INSERT: only create tasks as yourself
  CREATE POLICY tasks_insert ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

  -- UPDATE: only update your own tasks
  CREATE POLICY tasks_update ON public.tasks
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  -- DELETE: only delete your own tasks
  CREATE POLICY tasks_delete ON public.tasks
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

  GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated, service_role;
END $$;

NOTIFY pgrst, 'reload schema';
