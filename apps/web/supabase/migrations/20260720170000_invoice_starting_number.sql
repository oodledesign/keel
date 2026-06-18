-- Allow businesses to set the first invoice number (e.g. INV-0042) before issuing invoices.

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS invoice_starting_number integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.account_payment_settings.invoice_starting_number IS
  'Next invoice sequence number to allocate (INV-0001 format). Only editable before the first invoice is issued.';

ALTER TABLE public.account_payment_settings
  DROP CONSTRAINT IF EXISTS account_payment_settings_invoice_starting_number_check;

ALTER TABLE public.account_payment_settings
  ADD CONSTRAINT account_payment_settings_invoice_starting_number_check
  CHECK (invoice_starting_number >= 1 AND invoice_starting_number <= 999999);
