-- Unify delivery jobs and campaign trackers into public.projects (project_type delivery | campaign).

-- ---------------------------------------------------------------------------
-- 1) Extend projects for delivery fields + type discriminator
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_minutes integer,
  ADD COLUMN IF NOT EXISTS value_pence integer,
  ADD COLUMN IF NOT EXISTS cost_pence integer,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

UPDATE public.projects
SET project_type = 'campaign'
WHERE project_type IS NULL OR project_type = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_project_type_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_project_type_check
      CHECK (project_type IN ('delivery', 'campaign'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_delivery_status_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_delivery_status_check
      CHECK (
        project_type <> 'delivery'
        OR status IS NULL
        OR status IN ('pending', 'in_progress', 'on_hold', 'completed', 'cancelled')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_delivery_priority_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_delivery_priority_check
      CHECK (
        project_type <> 'delivery'
        OR priority IS NULL
        OR priority IN ('low', 'medium', 'high', 'urgent')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.projects.project_type IS
  'delivery = phased client work (formerly jobs); campaign = multi-client spreadsheet tracker.';

CREATE INDEX IF NOT EXISTS ix_projects_account_id_type
  ON public.projects (account_id, project_type);

CREATE INDEX IF NOT EXISTS ix_projects_account_id_status
  ON public.projects (account_id, status)
  WHERE project_type = 'delivery';

CREATE INDEX IF NOT EXISTS ix_projects_account_id_due_date
  ON public.projects (account_id, due_date)
  WHERE project_type = 'delivery';

-- ---------------------------------------------------------------------------
-- 2) Migrate jobs rows into projects (preserve ids)
-- ---------------------------------------------------------------------------
INSERT INTO public.projects (
  id,
  account_id,
  name,
  project_type,
  title,
  description,
  status,
  priority,
  start_date,
  due_date,
  estimated_minutes,
  actual_minutes,
  value_pence,
  cost_pence,
  created_by,
  client_id,
  created_at,
  updated_at
)
SELECT
  j.id,
  j.account_id,
  j.title,
  'delivery',
  j.title,
  j.description,
  j.status,
  j.priority,
  j.start_date,
  j.due_date,
  j.estimated_minutes,
  j.actual_minutes,
  j.value_pence,
  j.cost_pence,
  j.created_by,
  j.client_id,
  j.created_at,
  j.updated_at
FROM public.jobs j
ON CONFLICT (id) DO UPDATE SET
  project_type = EXCLUDED.project_type,
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  start_date = EXCLUDED.start_date,
  due_date = EXCLUDED.due_date,
  estimated_minutes = EXCLUDED.estimated_minutes,
  actual_minutes = EXCLUDED.actual_minutes,
  value_pence = EXCLUDED.value_pence,
  cost_pence = EXCLUDED.cost_pence,
  created_by = EXCLUDED.created_by,
  client_id = COALESCE(public.projects.client_id, EXCLUDED.client_id),
  updated_at = EXCLUDED.updated_at;

-- ---------------------------------------------------------------------------
-- 3) Merge job_assignments → project_assignments
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS role_on_project text,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE;

INSERT INTO public.project_assignments (project_id, user_id, role_on_project, account_id)
SELECT ja.job_id, ja.user_id, ja.role_on_job, ja.account_id
FROM public.job_assignments ja
ON CONFLICT (project_id, user_id) DO UPDATE SET
  role_on_project = COALESCE(EXCLUDED.role_on_project, public.project_assignments.role_on_project),
  account_id = COALESCE(EXCLUDED.account_id, public.project_assignments.account_id);

-- ---------------------------------------------------------------------------
-- 4) Rename job_id → project_id on child tables
-- ---------------------------------------------------------------------------

-- project_phases
ALTER TABLE public.project_phases
  DROP CONSTRAINT IF EXISTS project_phases_job_id_fkey;

ALTER TABLE public.project_phases
  RENAME COLUMN job_id TO project_id;

ALTER TABLE public.project_phases
  ADD CONSTRAINT project_phases_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS ix_project_phases_job_id;
DROP INDEX IF EXISTS ix_project_phases_job_id_sort_order;
CREATE INDEX IF NOT EXISTS ix_project_phases_project_id
  ON public.project_phases (project_id);
CREATE INDEX IF NOT EXISTS ix_project_phases_project_id_sort_order
  ON public.project_phases (project_id, sort_order);

COMMENT ON TABLE public.project_phases IS
  'Delivery phases for a project (board / timeline). Parent is projects.id where project_type = delivery.';

-- job_notes → project_delivery_notes (avoid confusion with work notes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_delivery_notes'
  ) THEN
    ALTER TABLE public.job_notes RENAME TO project_delivery_notes;
  END IF;
END $$;

ALTER TABLE public.project_delivery_notes
  DROP CONSTRAINT IF EXISTS job_notes_job_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_delivery_notes'
      AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.project_delivery_notes RENAME COLUMN job_id TO project_id;
  END IF;
END $$;

ALTER TABLE public.project_delivery_notes
  DROP CONSTRAINT IF EXISTS project_delivery_notes_project_id_fkey;

ALTER TABLE public.project_delivery_notes
  ADD CONSTRAINT project_delivery_notes_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;

-- job_events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_events'
  ) THEN
    ALTER TABLE public.job_events RENAME TO project_events;
  END IF;
END $$;

ALTER TABLE public.project_events
  DROP CONSTRAINT IF EXISTS job_events_job_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_events'
      AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.project_events RENAME COLUMN job_id TO project_id;
  END IF;
END $$;

ALTER TABLE public.project_events
  DROP CONSTRAINT IF EXISTS project_events_project_id_fkey;

ALTER TABLE public.project_events
  ADD CONSTRAINT project_events_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;

-- job_event_assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_event_assignments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_event_assignments'
  ) THEN
    ALTER TABLE public.job_event_assignments RENAME TO project_event_assignments;
  END IF;
END $$;

-- tasks: coalesce job_id into project_id, then drop job_id
UPDATE public.tasks t
SET project_id = t.job_id
WHERE t.job_id IS NOT NULL
  AND (t.project_id IS NULL OR t.project_id IS DISTINCT FROM t.job_id);

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_job_id_fkey;
DROP INDEX IF EXISTS ix_tasks_job_id;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS job_id;

-- Other public tables referencing jobs
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'invoices',
    'websites',
    'chat_threads',
    'meeting_action_items'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'job_id'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET project_id = job_id WHERE job_id IS NOT NULL AND project_id IS NULL',
        tbl
      );
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
        tbl,
        tbl || '_job_id_fkey'
      );
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS job_id', tbl);
    END IF;
  END LOOP;
END $$;

-- notes / docs job_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'job_id'
  ) THEN
    UPDATE public.notes SET project_id = job_id WHERE job_id IS NOT NULL AND project_id IS NULL;
    ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_job_id_fkey;
    ALTER TABLE public.notes DROP COLUMN IF EXISTS job_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'docs' AND column_name = 'job_id'
  ) THEN
    UPDATE public.docs SET project_id = job_id WHERE job_id IS NOT NULL AND project_id IS NULL;
    ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_job_id_fkey;
    ALTER TABLE public.docs DROP COLUMN IF EXISTS job_id;
  END IF;
END $$;

-- sops.runs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sops' AND table_name = 'runs' AND column_name = 'job_id'
  ) THEN
    UPDATE sops.runs SET project_id = job_id WHERE job_id IS NOT NULL AND project_id IS NULL;
    ALTER TABLE sops.runs DROP CONSTRAINT IF EXISTS runs_job_id_fkey;
    ALTER TABLE sops.runs DROP COLUMN IF EXISTS job_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Contractor helper aliases (RLS policies still reference job helpers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contractor_assigned_to_job(job_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT public.contractor_assigned_to_project(job_id);
$$;

GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_job(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Drop legacy jobs tables
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.job_assignments CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;

-- ---------------------------------------------------------------------------
-- 7) Refresh projects RLS for delivery + campaign
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND NOT public.is_client_on_account (account_id)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_project (id)
    )
    AND (
      project_type = 'campaign'
      OR public.has_permission (auth.uid (), account_id, 'jobs.view'::public.app_permissions)
      OR (
        public.is_contractor_on_account (account_id)
        AND public.contractor_assigned_to_project (id)
      )
    )
  );

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_project (id)
    )
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_project (id)
    )
  );

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

-- project_phases policies: swap jobs → projects references
DROP POLICY IF EXISTS project_phases_insert ON public.project_phases;
CREATE POLICY project_phases_insert ON public.project_phases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_phases.project_id
        AND p.account_id = project_phases.account_id
        AND p.project_type = 'delivery'
    )
  );

NOTIFY pgrst, 'reload schema';
