-- Phased project delivery: project_phases on jobs + task/doc/note links.
-- Additive only — does not modify existing RLS policies on tasks/jobs/docs/notes.

CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'not_started',
  is_milestone boolean NOT NULL DEFAULT false,
  colour text,
  sort_order integer NOT NULL DEFAULT 0,
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_phases_status_check CHECK (
    status IN ('not_started', 'in_progress', 'blocked', 'complete')
  )
);

COMMENT ON TABLE public.project_phases IS
  'Delivery phases for a job (project board / timeline). Parent is jobs.id.';

CREATE INDEX IF NOT EXISTS ix_project_phases_account_id
  ON public.project_phases (account_id);

CREATE INDEX IF NOT EXISTS ix_project_phases_job_id
  ON public.project_phases (job_id);

CREATE INDEX IF NOT EXISTS ix_project_phases_job_id_sort_order
  ON public.project_phases (job_id, sort_order);

DROP TRIGGER IF EXISTS project_phases_set_timestamps ON public.project_phases;
CREATE TRIGGER project_phases_set_timestamps
  BEFORE INSERT OR UPDATE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phases TO authenticated, service_role;

DROP POLICY IF EXISTS project_phases_select ON public.project_phases;
CREATE POLICY project_phases_select ON public.project_phases
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND NOT public.is_client_on_account (account_id)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_job (job_id)
    )
  );

DROP POLICY IF EXISTS project_phases_insert ON public.project_phases;
CREATE POLICY project_phases_insert ON public.project_phases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = project_phases.job_id
        AND j.account_id = project_phases.account_id
    )
  );

DROP POLICY IF EXISTS project_phases_update ON public.project_phases;
CREATE POLICY project_phases_update ON public.project_phases
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = project_phases.job_id
        AND j.account_id = project_phases.account_id
    )
  );

DROP POLICY IF EXISTS project_phases_delete ON public.project_phases;
CREATE POLICY project_phases_delete ON public.project_phases
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

-- Link tasks, docs, and notes to jobs/phases (nullable — personal tasks unchanged).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS job_id uuid,
      ADD COLUMN IF NOT EXISTS phase_id uuid;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'tasks_job_id_fkey'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_job_id_fkey
        FOREIGN KEY (job_id) REFERENCES public.jobs (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'tasks_phase_id_fkey'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_phase_id_fkey
        FOREIGN KEY (phase_id) REFERENCES public.project_phases (id) ON DELETE SET NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS ix_tasks_job_id ON public.tasks (job_id)
      WHERE job_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS ix_tasks_phase_id ON public.tasks (phase_id)
      WHERE phase_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'docs'
  ) THEN
    ALTER TABLE public.docs
      ADD COLUMN IF NOT EXISTS phase_id uuid;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'docs_phase_id_fkey'
    ) THEN
      ALTER TABLE public.docs
        ADD CONSTRAINT docs_phase_id_fkey
        FOREIGN KEY (phase_id) REFERENCES public.project_phases (id) ON DELETE SET NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS ix_docs_phase_id ON public.docs (phase_id)
      WHERE phase_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notes'
  ) THEN
    ALTER TABLE public.notes
      ADD COLUMN IF NOT EXISTS phase_id uuid;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'notes_phase_id_fkey'
    ) THEN
      ALTER TABLE public.notes
        ADD CONSTRAINT notes_phase_id_fkey
        FOREIGN KEY (phase_id) REFERENCES public.project_phases (id) ON DELETE SET NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS ix_notes_phase_id ON public.notes (phase_id)
      WHERE phase_id IS NOT NULL;
  END IF;
END $$;

-- Extra permissive task policies for job-linked delivery tasks (additive only).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS tasks_select_via_job ON public.tasks;
  CREATE POLICY tasks_select_via_job ON public.tasks
    FOR SELECT TO authenticated
    USING (
      job_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.id = tasks.job_id
          AND public.has_role_on_account (j.account_id)
          AND NOT public.is_client_on_account (j.account_id)
          AND (
            NOT public.is_contractor_on_account (j.account_id)
            OR public.contractor_assigned_to_job (j.id)
          )
      )
    );

  DROP POLICY IF EXISTS tasks_update_via_job ON public.tasks;
  CREATE POLICY tasks_update_via_job ON public.tasks
    FOR UPDATE TO authenticated
    USING (
      job_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.id = tasks.job_id
          AND public.has_permission (auth.uid (), j.account_id, 'jobs.edit'::public.app_permissions)
          AND NOT public.is_contractor_on_account (j.account_id)
      )
    )
    WITH CHECK (
      job_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.id = tasks.job_id
          AND public.has_permission (auth.uid (), j.account_id, 'jobs.edit'::public.app_permissions)
          AND NOT public.is_contractor_on_account (j.account_id)
      )
    );
END $$;

NOTIFY pgrst, 'reload schema';
