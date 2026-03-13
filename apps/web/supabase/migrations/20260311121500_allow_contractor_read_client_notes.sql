-- Allow contractors to read client notes for clients they are already allowed
-- to view through assigned jobs/projects. Write access remains staff/admin/owner only.

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
        OR (c.project_id IS NOT NULL AND public.contractor_assigned_to_project(c.project_id))
      )
  )
);
