-- Harden project_guests RLS: managers only (jobs.edit, exclude contractor/client);
-- invitees must not UPDATE (accept uses service/admin). Always derive task_comments.account_id.

CREATE OR REPLACE FUNCTION public.task_comments_set_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t_project uuid;
  t_account uuid;
BEGIN
  SELECT t.project_id, COALESCE(t.account_id, p.account_id)
  INTO t_project, t_account
  FROM public.tasks t
  LEFT JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = NEW.task_id;

  IF t_project IS NULL THEN
    RAISE EXCEPTION 'task_comments: task % has no project_id', NEW.task_id;
  END IF;

  NEW.project_id := t_project;
  NEW.account_id := t_account;

  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'task_comments: could not resolve account_id for task %', NEW.task_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS project_guests_insert ON public.project_guests;
CREATE POLICY project_guests_insert
  ON public.project_guests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  );

DROP POLICY IF EXISTS project_guests_update ON public.project_guests;
CREATE POLICY project_guests_update
  ON public.project_guests
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  )
  WITH CHECK (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'jobs.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  );
