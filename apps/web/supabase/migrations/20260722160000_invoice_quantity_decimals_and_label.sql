-- Allow fractional invoice line quantities (e.g. 2.5 hours) and workspace quantity column label.

ALTER TABLE public.invoice_items
  ALTER COLUMN quantity TYPE numeric(12, 2) USING quantity::numeric(12, 2);

COMMENT ON COLUMN public.invoice_items.quantity IS
  'Line quantity; supports up to 2 decimal places (e.g. hours).';

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS invoice_quantity_label text NOT NULL DEFAULT 'quantity';

ALTER TABLE public.account_payment_settings
  DROP CONSTRAINT IF EXISTS account_payment_settings_invoice_quantity_label_check;

ALTER TABLE public.account_payment_settings
  ADD CONSTRAINT account_payment_settings_invoice_quantity_label_check
  CHECK (invoice_quantity_label IN ('quantity', 'hours'));

COMMENT ON COLUMN public.account_payment_settings.invoice_quantity_label IS
  'Column label for line item quantity on invoices (quantity or hours).';
