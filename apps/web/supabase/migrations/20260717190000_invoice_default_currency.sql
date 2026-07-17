-- Workspace default invoice currency + integrity check on invoices.currency.

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS default_invoice_currency text NOT NULL DEFAULT 'gbp';

ALTER TABLE public.account_payment_settings
  DROP CONSTRAINT IF EXISTS account_payment_settings_default_invoice_currency_check;

ALTER TABLE public.account_payment_settings
  ADD CONSTRAINT account_payment_settings_default_invoice_currency_check
  CHECK (
    lower(default_invoice_currency) IN (
      'gbp',
      'usd',
      'eur',
      'aud',
      'cad',
      'nzd',
      'chf'
    )
  );

COMMENT ON COLUMN public.account_payment_settings.default_invoice_currency IS
  'Default ISO currency code for new invoices (lowercase).';

-- Normalize existing invoice currencies that are outside the supported set.
UPDATE public.invoices
SET currency = 'gbp'
WHERE lower(currency) NOT IN (
  'gbp',
  'usd',
  'eur',
  'aud',
  'cad',
  'nzd',
  'chf'
);

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_currency_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_currency_check
  CHECK (
    lower(currency) IN (
      'gbp',
      'usd',
      'eur',
      'aud',
      'cad',
      'nzd',
      'chf'
    )
  );
