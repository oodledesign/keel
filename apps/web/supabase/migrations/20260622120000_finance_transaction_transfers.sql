-- Allow marking transactions as internal transfers (excluded from income/expense totals).

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_finance_transactions_account_transfer
  ON public.finance_transactions (account_id, is_transfer)
  WHERE is_transfer = true;

COMMENT ON COLUMN public.finance_transactions.is_transfer IS
  'When true, transaction is an internal transfer and excluded from income/expense summaries.';

NOTIFY pgrst, 'reload schema';
