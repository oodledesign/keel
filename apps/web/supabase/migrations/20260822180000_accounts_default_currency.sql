-- Workspace-wide default currency on accounts (invoices, finances, properties, etc.)

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'gbp';

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_default_currency_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_default_currency_check
  CHECK (
    lower(default_currency) IN (
      'gbp',
      'usd',
      'eur',
      'aud',
      'cad',
      'nzd',
      'chf'
    )
  );

COMMENT ON COLUMN public.accounts.default_currency IS
  'Workspace default ISO currency code (lowercase) for finances, invoices, properties, and new documents.';

-- Backfill from invoice payment settings where configured.
UPDATE public.accounts a
SET default_currency = lower(aps.default_invoice_currency)
FROM public.account_payment_settings aps
WHERE aps.account_id = a.id
  AND lower(aps.default_invoice_currency) IN (
    'gbp',
    'usd',
    'eur',
    'aud',
    'cad',
    'nzd',
    'chf'
  );
