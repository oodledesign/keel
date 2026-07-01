-- Starling Bank connector: extend finance_connections and finance_transactions.

ALTER TABLE public.finance_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text;

ALTER TABLE public.finance_connections
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;

ALTER TABLE public.finance_connections DROP CONSTRAINT IF EXISTS finance_connections_provider_check;
ALTER TABLE public.finance_connections ADD CONSTRAINT finance_connections_provider_check
  CHECK (provider IN ('freeagent', 'starling'));

ALTER TABLE public.finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_source_check;
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_source_check
  CHECK (source IN ('manual', 'csv', 'freeagent', 'starling'));

COMMENT ON COLUMN public.finance_connections.access_token_encrypted IS
  'AES-256-GCM encrypted access token (Starling and future providers).';
COMMENT ON COLUMN public.finance_connections.refresh_token_encrypted IS
  'AES-256-GCM encrypted refresh token (Starling and future providers).';

ALTER TABLE public.finance_bank_accounts DROP CONSTRAINT IF EXISTS finance_bank_accounts_source_check;
ALTER TABLE public.finance_bank_accounts ADD CONSTRAINT finance_bank_accounts_source_check
  CHECK (source IN ('manual', 'csv', 'freeagent', 'starling'));

ALTER TABLE public.finance_bank_accounts
  ADD COLUMN IF NOT EXISTS starling_account_uid text,
  ADD COLUMN IF NOT EXISTS starling_category_uid text;

CREATE UNIQUE INDEX IF NOT EXISTS ix_finance_bank_accounts_account_starling
  ON public.finance_bank_accounts (account_id, starling_account_uid, starling_category_uid)
  WHERE starling_account_uid IS NOT NULL AND starling_category_uid IS NOT NULL;

NOTIFY pgrst, 'reload schema';
