-- Workspace-scoped tasks without requiring project/client linkage (desktop recorder).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_tasks_account_id
  ON public.tasks (account_id)
  WHERE account_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.account_id IS
  'Team workspace this task belongs to when not linked via project_id or client_id.';

DROP POLICY IF EXISTS tasks_select_via_account ON public.tasks;
CREATE POLICY tasks_select_via_account ON public.tasks
  FOR SELECT TO authenticated
  USING (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = tasks.account_id
        AND am.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
