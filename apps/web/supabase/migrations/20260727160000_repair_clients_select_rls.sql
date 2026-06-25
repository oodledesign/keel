-- After jobs → projects unify, clients_select still referenced public.jobs (dropped).
-- Repair contractor visibility paths to use projects only.

DROP POLICY IF EXISTS clients_select ON public.clients;

CREATE POLICY clients_select ON public.clients
FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR (
      project_id IS NOT NULL
      AND public.contractor_assigned_to_project(project_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.client_id = public.clients.id
        AND p.account_id = public.clients.account_id
        AND public.contractor_assigned_to_project(p.id)
    )
  )
);

DROP POLICY IF EXISTS client_notes_select ON public.client_notes;

CREATE POLICY client_notes_select ON public.client_notes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_notes.client_id
      AND c.account_id = client_notes.account_id
      AND public.has_role_on_account(c.account_id)
      AND (
        NOT public.is_contractor_on_account(c.account_id)
        OR (
          c.project_id IS NOT NULL
          AND public.contractor_assigned_to_project(c.project_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.projects p
          WHERE p.client_id = c.id
            AND p.account_id = c.account_id
            AND public.contractor_assigned_to_project(p.id)
        )
      )
  )
);

NOTIFY pgrst, 'reload schema';
