-- Scheduled one-off invoice sends (remain draft until send time).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_send_to_emails text[],
  ADD COLUMN IF NOT EXISTS scheduled_send_processing_at timestamptz;

COMMENT ON COLUMN public.invoices.scheduled_send_at IS
  'When a draft invoice should be emailed. Null = not scheduled.';

COMMENT ON COLUMN public.invoices.scheduled_send_to_emails IS
  'Recipients for a scheduled send. Cleared after send or cancel.';

COMMENT ON COLUMN public.invoices.scheduled_send_processing_at IS
  'Claim marker for concurrent cron workers processing a scheduled send.';

CREATE INDEX IF NOT EXISTS ix_invoices_scheduled_send_due
  ON public.invoices (scheduled_send_at)
  WHERE status = 'draft'
    AND scheduled_send_at IS NOT NULL
    AND scheduled_send_processing_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_due_scheduled_invoice_sends(
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT i.id
    FROM public.invoices i
    WHERE i.status = 'draft'
      AND i.scheduled_send_at IS NOT NULL
      AND i.scheduled_send_at <= now()
      AND (
        i.scheduled_send_processing_at IS NULL
        OR i.scheduled_send_processing_at < now() - interval '15 minutes'
      )
    ORDER BY i.scheduled_send_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.invoices i
    SET scheduled_send_processing_at = now()
    WHERE i.id IN (SELECT id FROM due)
    RETURNING i.*
  )
  SELECT * FROM claimed;
END;
$$;

COMMENT ON FUNCTION public.claim_due_scheduled_invoice_sends(integer) IS
  'Claims due draft invoices with a scheduled send for cron processing.';

GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_invoice_sends(integer)
  TO service_role;
