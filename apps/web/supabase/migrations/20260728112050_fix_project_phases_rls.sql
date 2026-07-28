-- Recreate project_phases SELECT/UPDATE/DELETE policies after jobs→projects unify.
-- DROP TABLE jobs CASCADE removed policies that referenced public.jobs; only INSERT was
-- recreated in 20260726120000, so UPDATE returned 0 rows and .single() failed with
-- "Cannot coerce the result to a single JSON object".

DROP POLICY IF EXISTS project_phases_select ON public.project_phases;
CREATE POLICY project_phases_select ON public.project_phases
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND NOT public.is_client_on_account (account_id)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_project (project_id)
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
      FROM public.projects p
      WHERE p.id = project_phases.project_id
        AND p.account_id = project_phases.account_id
        AND p.project_type = 'delivery'
    )
  );

DROP POLICY IF EXISTS project_phases_delete ON public.project_phases;
CREATE POLICY project_phases_delete ON public.project_phases
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

NOTIFY pgrst, 'reload schema';
