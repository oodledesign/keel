-- Property assignment and custom notes on finance transactions.

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS ix_finance_transactions_account_property
  ON public.finance_transactions (account_id, property_id)
  WHERE property_id IS NOT NULL;

COMMENT ON COLUMN public.finance_transactions.property_id IS
  'Optional property this transaction relates to (property workspaces).';
COMMENT ON COLUMN public.finance_transactions.notes IS
  'User notes or imported bank reference details for this transaction.';

NOTIFY pgrst, 'reload schema';
