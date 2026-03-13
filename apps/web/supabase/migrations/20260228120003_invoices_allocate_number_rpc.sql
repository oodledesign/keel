-- Allocate next invoice number for an account (transaction-safe). Used when creating a new invoice.
-- Returns formatted number e.g. INV-0001. Creates counter row if missing.

CREATE OR REPLACE FUNCTION public.allocate_invoice_number(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next integer;
  v_formatted text;
BEGIN
  -- Insert or get counter row; lock for update
  INSERT INTO public.invoice_counters (account_id, next_number)
  VALUES (p_account_id, 1)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT next_number INTO v_next
  FROM public.invoice_counters
  WHERE account_id = p_account_id
  FOR UPDATE;

  v_formatted := 'INV-' || lpad(v_next::text, 4, '0');

  UPDATE public.invoice_counters
  SET next_number = next_number + 1
  WHERE account_id = p_account_id;

  RETURN v_formatted;
END;
$$;

COMMENT ON FUNCTION public.allocate_invoice_number(uuid) IS 'Allocates next invoice number for account; call when creating a new invoice.';
GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(uuid) TO authenticated;
