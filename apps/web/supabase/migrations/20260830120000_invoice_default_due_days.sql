-- Default invoice due date (days after issue) for new invoices and recurring series.

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS default_invoice_due_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.account_payment_settings
  DROP CONSTRAINT IF EXISTS account_payment_settings_default_invoice_due_days_check;

ALTER TABLE public.account_payment_settings
  ADD CONSTRAINT account_payment_settings_default_invoice_due_days_check
  CHECK (default_invoice_due_days >= 0 AND default_invoice_due_days <= 365);

COMMENT ON COLUMN public.account_payment_settings.default_invoice_due_days IS
  'Days after issue date for the default due date on new invoices (0 = due on issue date).';

ALTER TABLE public.invoice_recurring_series
  ADD COLUMN IF NOT EXISTS due_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.invoice_recurring_series
  DROP CONSTRAINT IF EXISTS invoice_recurring_series_due_days_check;

ALTER TABLE public.invoice_recurring_series
  ADD CONSTRAINT invoice_recurring_series_due_days_check
  CHECK (due_days >= 0 AND due_days <= 365);

COMMENT ON COLUMN public.invoice_recurring_series.due_days IS
  'Days after each issue date for the generated invoice due date.';
