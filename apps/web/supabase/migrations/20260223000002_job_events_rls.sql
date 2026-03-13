-- Job events RLS: Owner/Admin/Staff full CRUD; Contractor can see if assigned to job or event, can only UPDATE (notes enforced in app).
-- Client: no access.

-- 1) Helper: contractor can see a job_event if assigned to the job OR assigned to the event
CREATE OR REPLACE FUNCTION public.contractor_can_see_job_event(p_job_event_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_events je
    WHERE je.id = p_job_event_id
      AND public.is_contractor_on_account(je.account_id)
      AND (
        public.contractor_assigned_to_job(je.job_id)
        OR EXISTS (
          SELECT 1 FROM public.job_event_assignments ea
          WHERE ea.job_event_id = je.id AND ea.user_id = auth.uid()
        )
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.contractor_can_see_job_event(uuid) TO authenticated;

-- 2) job_events: enable RLS and policies
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

-- job_events SELECT: org members except client; contractor only if assigned to job or event
CREATE POLICY job_events_select ON public.job_events FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND NOT public.is_client_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR public.contractor_can_see_job_event(id)
  )
);

-- job_events INSERT: Owner/Admin/Staff with jobs.edit only; WITH CHECK prevents account_id spoofing
CREATE POLICY job_events_insert ON public.job_events FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

-- job_events UPDATE: Owner/Admin/Staff full; Contractor only on rows they can see (app restricts to notes-only)
CREATE POLICY job_events_update ON public.job_events FOR UPDATE TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND NOT public.is_client_on_account(account_id)
  AND (
    (public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions) AND NOT public.is_contractor_on_account(account_id))
    OR public.contractor_can_see_job_event(id)
  )
)
WITH CHECK (
  public.has_role_on_account(account_id)
  AND (
    (public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions) AND NOT public.is_contractor_on_account(account_id))
    OR public.contractor_can_see_job_event(id)
  )
);

-- job_events DELETE: Owner/Admin/Staff only; contractors cannot delete
CREATE POLICY job_events_delete ON public.job_events FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_events TO authenticated;

-- 3) job_event_assignments: enable RLS and policies
ALTER TABLE public.job_event_assignments ENABLE ROW LEVEL SECURITY;

-- job_event_assignments SELECT: only for events the user can see
CREATE POLICY job_event_assignments_select ON public.job_event_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_events je
    WHERE je.id = job_event_assignments.job_event_id
      AND public.has_role_on_account(je.account_id)
      AND NOT public.is_client_on_account(je.account_id)
      AND (
        NOT public.is_contractor_on_account(je.account_id)
        OR public.contractor_can_see_job_event(je.id)
      )
  )
);

-- job_event_assignments INSERT: Owner/Admin/Staff with jobs.edit only; account_id must match event's org
CREATE POLICY job_event_assignments_insert ON public.job_event_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_events je
    WHERE je.id = job_event_assignments.job_event_id
      AND je.account_id = job_event_assignments.account_id
      AND public.has_permission(auth.uid(), je.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(je.account_id)
  )
);

-- job_event_assignments UPDATE: Owner/Admin/Staff with jobs.edit only
CREATE POLICY job_event_assignments_update ON public.job_event_assignments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_events je
    WHERE je.id = job_event_assignments.job_event_id
      AND public.has_permission(auth.uid(), je.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(je.account_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_events je
    WHERE je.id = job_event_assignments.job_event_id
      AND je.account_id = job_event_assignments.account_id
      AND public.has_permission(auth.uid(), je.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(je.account_id)
  )
);

-- job_event_assignments DELETE: Owner/Admin/Staff with jobs.edit only
CREATE POLICY job_event_assignments_delete ON public.job_event_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_events je
    WHERE je.id = job_event_assignments.job_event_id
      AND public.has_permission(auth.uid(), je.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(je.account_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_event_assignments TO authenticated;
