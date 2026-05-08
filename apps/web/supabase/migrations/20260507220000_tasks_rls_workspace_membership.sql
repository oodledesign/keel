-- Widen tasks RLS so workspace members can read tasks linked to projects or clients
-- in accounts they belong to (covers family/homegroup shared projects).
--
-- Remote DBs may differ: some have public.projects.account_id, others only
-- projects.business_id → businesses.account_id. We branch on information_schema
-- so the migration never references missing columns.
--
-- Only applies if public.tasks already exists (local vs prod safety check).

DO $$
DECLARE
  has_projects_account_id boolean;
  has_projects_business_id boolean;
  has_businesses boolean;
  has_businesses_account_id boolean;
  has_tasks_client_id boolean;
  has_clients_account_id boolean;
  parts text[] := ARRAY[]::text[];
  workspace_or text;
  using_expr text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'account_id'
  ) INTO has_projects_account_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'business_id'
  ) INTO has_projects_business_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) INTO has_businesses;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'account_id'
  ) INTO has_businesses_account_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'client_id'
  ) INTO has_tasks_client_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'account_id'
  ) INTO has_clients_account_id;

  IF has_projects_account_id THEN
    parts := array_append(
      parts,
      $sql$
      (tasks.project_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.projects p
        JOIN public.accounts_memberships am ON am.account_id = p.account_id
        WHERE p.id = tasks.project_id
          AND am.user_id = auth.uid()
      ))
      $sql$
    );
  END IF;

  IF has_projects_business_id AND has_businesses AND has_businesses_account_id THEN
    parts := array_append(
      parts,
      $sql$
      (tasks.project_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.projects p
        JOIN public.businesses b ON b.id = p.business_id
        JOIN public.accounts_memberships am ON am.account_id = b.account_id
        WHERE p.id = tasks.project_id
          AND b.account_id IS NOT NULL
          AND am.user_id = auth.uid()
      ))
      $sql$
    );
  END IF;

  IF has_tasks_client_id AND has_clients_account_id THEN
    parts := array_append(
      parts,
      $sql$
      (tasks.client_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.accounts_memberships am ON am.account_id = c.account_id
        WHERE c.id = tasks.client_id
          AND am.user_id = auth.uid()
      ))
      $sql$
    );
  END IF;

  IF array_length(parts, 1) IS NOT NULL AND array_length(parts, 1) > 0 THEN
    workspace_or := '(' || array_to_string(parts, ' OR ') || ')';
    using_expr := 'user_id = auth.uid() OR ' || workspace_or;
  ELSE
    using_expr := 'user_id = auth.uid()';
  END IF;

  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tasks' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
  END IF;

  DROP POLICY IF EXISTS tasks_select ON public.tasks;
  DROP POLICY IF EXISTS tasks_insert ON public.tasks;
  DROP POLICY IF EXISTS tasks_update ON public.tasks;
  DROP POLICY IF EXISTS tasks_delete ON public.tasks;

  EXECUTE format(
    'CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (%s)',
    using_expr
  );

  CREATE POLICY tasks_insert ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY tasks_update ON public.tasks
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY tasks_delete ON public.tasks
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

  GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated, service_role;
END $$;

NOTIFY pgrst, 'reload schema';
