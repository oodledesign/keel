-- Finances module: transactions, categories, imports, FreeAgent connection.

CREATE TABLE IF NOT EXISTS public.finance_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'freeagent' CHECK (provider IN ('freeagent')),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  freeagent_company_url text,
  freeagent_company_name text,
  last_sync_at timestamptz,
  sync_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_connections_account_provider UNIQUE (account_id, provider)
);

CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  color text,
  freeagent_category_url text,
  freeagent_category_id text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_finance_categories_account_fa_url
  ON public.finance_categories (account_id, freeagent_category_url)
  WHERE freeagent_category_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_finance_categories_account_kind
  ON public.finance_categories (account_id, kind);

CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'freeagent')),
  freeagent_bank_account_url text,
  freeagent_bank_account_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_finance_bank_accounts_account_fa_url
  ON public.finance_bank_accounts (account_id, freeagent_bank_account_url)
  WHERE freeagent_bank_account_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.finance_bank_accounts (id) ON DELETE SET NULL,
  filename text NOT NULL,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'mapped', 'imported', 'failed')
  ),
  row_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.finance_bank_accounts (id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.finance_categories (id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  amount_pence integer NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  source text NOT NULL DEFAULT 'manual' CHECK (
    source IN ('manual', 'csv', 'freeagent')
  ),
  external_id text,
  freeagent_transaction_url text,
  freeagent_explanation_url text,
  sync_status text NOT NULL DEFAULT 'local' CHECK (
    sync_status IN ('local', 'synced', 'pending_push', 'push_failed')
  ),
  sync_error text,
  import_batch_id uuid REFERENCES public.finance_import_batches (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_finance_transactions_account_external
  ON public.finance_transactions (account_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_finance_transactions_account_fa_url
  ON public.finance_transactions (account_id, freeagent_transaction_url)
  WHERE freeagent_transaction_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_finance_transactions_account_date
  ON public.finance_transactions (account_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS ix_finance_transactions_account_category
  ON public.finance_transactions (account_id, category_id)
  WHERE category_id IS NOT NULL;

DROP TRIGGER IF EXISTS finance_connections_set_timestamps ON public.finance_connections;
CREATE TRIGGER finance_connections_set_timestamps
  BEFORE INSERT OR UPDATE ON public.finance_connections
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS finance_categories_set_timestamps ON public.finance_categories;
CREATE TRIGGER finance_categories_set_timestamps
  BEFORE INSERT OR UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS finance_bank_accounts_set_timestamps ON public.finance_bank_accounts;
CREATE TRIGGER finance_bank_accounts_set_timestamps
  BEFORE INSERT OR UPDATE ON public.finance_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS finance_transactions_set_timestamps ON public.finance_transactions;
CREATE TRIGGER finance_transactions_set_timestamps
  BEFORE INSERT OR UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.finance_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_connections TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_accounts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_import_batches TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_connections', 'finance_categories', 'finance_bank_accounts',
    'finance_import_batches', 'finance_transactions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.has_role_on_account(account_id))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role_on_account(account_id))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.has_role_on_account(account_id)) WITH CHECK (public.has_role_on_account(account_id))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.has_role_on_account(account_id))',
      t, t
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
