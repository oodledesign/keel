-- Portal: allow unauthenticated read of a single invoice by public_token.
-- Used by /portal/invoices/[token]. SECURITY DEFINER bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_invoice_for_portal(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', i.id,
    'account_id', i.account_id,
    'client_id', i.client_id,
    'invoice_number', i.invoice_number,
    'status', i.status,
    'due_at', i.due_at,
    'subtotal_pence', i.subtotal_pence,
    'total_pence', i.total_pence,
    'currency', i.currency,
    'notes', i.notes,
    'issued_at', i.issued_at,
    'sent_at', i.sent_at,
    'paid_at', i.paid_at,
    'created_at', i.created_at,
    'items', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', it.id,
          'description', it.description,
          'quantity', it.quantity,
          'unit_price_pence', it.unit_price_pence,
          'total_pence', it.total_pence,
          'sort_order', it.sort_order
        ) ORDER BY it.sort_order
      ) FROM public.invoice_items it WHERE it.invoice_id = i.id),
      '[]'::jsonb
    ),
    'client', (
      SELECT to_jsonb(c.*) FROM public.clients c WHERE c.id = i.client_id
    )
  ) INTO v_result
  FROM public.invoices i
  WHERE i.public_token = p_token
  LIMIT 1;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_invoice_for_portal(text) IS 'Returns one invoice by public_token for portal; no auth required.';
GRANT EXECUTE ON FUNCTION public.get_invoice_for_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_for_portal(text) TO authenticated;
