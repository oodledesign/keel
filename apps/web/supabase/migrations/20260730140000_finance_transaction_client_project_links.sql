-- Link finance transactions to CRM clients and delivery projects for project P&L.

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_finance_transactions_account_client
  ON public.finance_transactions (account_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_finance_transactions_account_project
  ON public.finance_transactions (account_id, project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.finance_transactions.client_id IS
  'Optional CRM client this transaction relates to.';
COMMENT ON COLUMN public.finance_transactions.project_id IS
  'Optional delivery project this transaction relates to (typically implies client via projects.client_id).';

NOTIFY pgrst, 'reload schema';
