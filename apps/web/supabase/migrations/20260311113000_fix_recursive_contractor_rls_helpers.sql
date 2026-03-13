-- Fix recursive contractor RLS helper functions.
--
-- The original contractor helpers queried tables protected by policies that
-- called the same helpers again, which caused:
--   "stack depth limit exceeded"
--
-- We keep the same business rules, but run the helper lookups as
-- SECURITY DEFINER so they can resolve assignment state without re-entering
-- the row policies on the same tables.

CREATE OR REPLACE FUNCTION public.contractor_assigned_to_project(project_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_assignments
    WHERE public.project_assignments.project_id = contractor_assigned_to_project.project_id
      AND public.project_assignments.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contractor_assigned_to_job(job_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_assignments
    WHERE public.job_assignments.job_id = contractor_assigned_to_job.job_id
      AND public.job_assignments.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contractor_can_see_job_event(p_job_event_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_events je
    WHERE je.id = p_job_event_id
      AND public.is_contractor_on_account(je.account_id)
      AND (
        public.contractor_assigned_to_job(je.job_id)
        OR EXISTS (
          SELECT 1
          FROM public.job_event_assignments ea
          WHERE ea.job_event_id = je.id
            AND ea.user_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.contractor_can_see_job_event(uuid) TO authenticated;
