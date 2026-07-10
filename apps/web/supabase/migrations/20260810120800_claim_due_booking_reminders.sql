-- Claim due booking reminders with FOR UPDATE SKIP LOCKED for concurrent cron workers.
-- Adds processing status so a claim is visible before send completes.

ALTER TABLE public.booking_reminders
  DROP CONSTRAINT IF EXISTS booking_reminders_status_check;

ALTER TABLE public.booking_reminders
  ADD CONSTRAINT booking_reminders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'processing'::text,
        'sent'::text,
        'failed'::text,
        'cancelled'::text
      ]
    )
  );

COMMENT ON COLUMN public.booking_reminders.status IS
  'pending | processing | sent | failed | cancelled';

CREATE OR REPLACE FUNCTION public.claim_due_booking_reminders(p_limit integer DEFAULT 50)
RETURNS SETOF public.booking_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT r.id
    FROM public.booking_reminders r
    WHERE r.status = 'pending'
      AND r.send_at <= now()
    ORDER BY r.send_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.booking_reminders r
    SET status = 'processing'
    WHERE r.id IN (SELECT id FROM due)
    RETURNING r.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_booking_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_booking_reminders(integer) TO service_role;

COMMENT ON FUNCTION public.claim_due_booking_reminders(integer) IS
  'Claims due pending booking_reminders for the cron worker using FOR UPDATE SKIP LOCKED.';
