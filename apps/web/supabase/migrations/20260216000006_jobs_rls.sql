-- Jobs V1 RLS: Owner/Admin/Staff full CRUD; Contractor row-level (assigned jobs only).
-- Client: no access (no policies grant client role access; has_role_on_account is still required).
-- Prevents cross-org access and account_id spoofing on writes via WITH CHECK.

-- 0) Add jobs.view and jobs.edit enum values (procedure + COMMIT so we can use them below)
CREATE OR REPLACE PROCEDURE public._migration_add_jobs_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'jobs.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'jobs.view';
  END IF;
  COMMIT;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'jobs.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'jobs.edit';
  END IF;
  COMMIT;
END;
$$;
CALL public._migration_add_jobs_permissions_enum();
DROP PROCEDURE public._migration_add_jobs_permissions_enum();

-- Owner, Admin, Staff: full jobs access within org
INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'jobs.view'::public.app_permissions),
  ('owner', 'jobs.edit'::public.app_permissions),
  ('admin', 'jobs.view'::public.app_permissions),
  ('admin', 'jobs.edit'::public.app_permissions),
  ('staff', 'jobs.view'::public.app_permissions),
  ('staff', 'jobs.edit'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

-- 1) Helpers: contractor assigned to job; client has no access to jobs
CREATE OR REPLACE FUNCTION public.is_client_on_account(account_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships
    WHERE accounts_memberships.account_id = is_client_on_account.account_id
      AND accounts_memberships.user_id = auth.uid()
      AND accounts_memberships.account_role = 'client'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_client_on_account(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contractor_assigned_to_job(job_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_assignments
    WHERE job_assignments.job_id = contractor_assigned_to_job.job_id
      AND job_assignments.user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_job(uuid) TO authenticated;

-- 2) jobs: enable RLS and policies
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Jobs SELECT: org members except client role; contractors only if assigned (cross-org denied by has_role_on_account)
CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND NOT public.is_client_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR public.contractor_assigned_to_job(id)
  )
);

-- Jobs INSERT: Owner/Admin/Staff with jobs.edit only; WITH CHECK prevents account_id spoofing
CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

-- Jobs UPDATE: Staff with jobs.edit on row's org, OR contractor only on assigned jobs; WITH CHECK keeps row in same org
CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
USING (
  (
    public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account(account_id)
  )
  OR (
    public.is_contractor_on_account(account_id)
    AND public.contractor_assigned_to_job(id)
  )
)
WITH CHECK (
  public.has_role_on_account(account_id)
  AND (
    (public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions) AND NOT public.is_contractor_on_account(account_id))
    OR (public.is_contractor_on_account(account_id) AND public.contractor_assigned_to_job(id))
  )
);

-- Jobs DELETE: Owner/Admin/Staff with jobs.edit only; contractors cannot delete
CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;

-- 3) job_assignments: enable RLS and policies
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

-- job_assignments SELECT: only for jobs the user can see (client role has no access)
CREATE POLICY job_assignments_select ON public.job_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND public.has_role_on_account(j.account_id)
      AND NOT public.is_client_on_account(j.account_id)
      AND (
        NOT public.is_contractor_on_account(j.account_id)
        OR public.contractor_assigned_to_job(j.id)
      )
  )
);

-- job_assignments INSERT: only Owner/Admin/Staff with jobs.edit; account_id must match job's org (prevents spoofing)
CREATE POLICY job_assignments_insert ON public.job_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND j.account_id = job_assignments.account_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
);

-- job_assignments UPDATE: Owner/Admin/Staff with jobs.edit only (contractors cannot manage assignments)
CREATE POLICY job_assignments_update ON public.job_assignments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND j.account_id = job_assignments.account_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
);

-- job_assignments DELETE: Owner/Admin/Staff with jobs.edit only
CREATE POLICY job_assignments_delete ON public.job_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_assignments TO authenticated;

-- 4) job_notes: enable RLS and policies
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

-- job_notes SELECT: only for jobs the user can see (client role has no access)
CREATE POLICY job_notes_select ON public.job_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_notes.job_id
      AND public.has_role_on_account(j.account_id)
      AND NOT public.is_client_on_account(j.account_id)
      AND (
        NOT public.is_contractor_on_account(j.account_id)
        OR public.contractor_assigned_to_job(j.id)
      )
  )
);

-- job_notes INSERT: Staff with jobs.edit, OR contractor only for assigned jobs; author must be self; account_id must match job (prevents spoofing)
CREATE POLICY job_notes_insert ON public.job_notes FOR INSERT TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_notes.job_id
      AND j.account_id = job_notes.account_id
      AND public.has_role_on_account(j.account_id)
      AND NOT public.is_client_on_account(j.account_id)
      AND (
        (public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions) AND NOT public.is_contractor_on_account(j.account_id))
        OR (public.is_contractor_on_account(j.account_id) AND public.contractor_assigned_to_job(j.id))
      )
  )
);

-- job_notes UPDATE: Owner/Admin/Staff with jobs.edit only (contractors cannot edit notes)
CREATE POLICY job_notes_update ON public.job_notes FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
)
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

-- job_notes DELETE: Owner/Admin/Staff with jobs.edit only (contractors cannot delete notes)
CREATE POLICY job_notes_delete ON public.job_notes FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_notes TO authenticated;
