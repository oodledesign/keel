-- Allow invoice starting number to be changed after invoices exist.
-- Existing INV-#### values stay put; only future allocations use the new next_number.

COMMENT ON COLUMN public.account_payment_settings.invoice_starting_number IS
  'Preferred next invoice sequence (INV-0001 format). Editable anytime; must be higher than any existing invoice number. Existing invoices are not renumbered.';
