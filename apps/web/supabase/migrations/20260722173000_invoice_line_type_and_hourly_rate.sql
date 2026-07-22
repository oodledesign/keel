-- Per-line invoice item type (quantity vs hours) and workspace default hourly rate.

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'quantity';

ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_line_type_check;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_line_type_check
  CHECK (line_type IN ('quantity', 'hours'));

COMMENT ON COLUMN public.invoice_items.line_type IS
  'quantity = qty × unit price; hours = billable hours using the workspace hourly rate.';

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS default_hourly_rate_pence integer;

ALTER TABLE public.account_payment_settings
  DROP CONSTRAINT IF EXISTS account_payment_settings_default_hourly_rate_pence_check;

ALTER TABLE public.account_payment_settings
  ADD CONSTRAINT account_payment_settings_default_hourly_rate_pence_check
  CHECK (
    default_hourly_rate_pence IS NULL
    OR default_hourly_rate_pence >= 0
  );

COMMENT ON COLUMN public.account_payment_settings.default_hourly_rate_pence IS
  'Default hourly rate in pence for new hours-based invoice line items.';

NOTIFY pgrst, 'reload schema';
