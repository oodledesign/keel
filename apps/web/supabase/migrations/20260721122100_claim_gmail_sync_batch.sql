-- Atomically claim Gmail users for a sync batch. SKIP LOCKED prevents
-- overlapping cron invocations from processing the same mailbox.

CREATE OR REPLACE FUNCTION public.claim_gmail_sync_batch(
  p_batch_size integer DEFAULT 8
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH next_users AS (
    SELECT connection.user_id
    FROM public.google_connections connection
    ORDER BY connection.updated_at ASC NULLS FIRST
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(COALESCE(p_batch_size, 8), 50))
  ),
  claimed AS (
    UPDATE public.google_connections connection
    SET updated_at = now()
    FROM next_users
    WHERE connection.user_id = next_users.user_id
    RETURNING connection.user_id
  )
  SELECT claimed.user_id
  FROM claimed;
$$;

REVOKE ALL ON FUNCTION public.claim_gmail_sync_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_gmail_sync_batch(integer)
  TO service_role;

COMMENT ON FUNCTION public.claim_gmail_sync_batch(integer) IS
  'Atomically claims the least-recently-attempted Gmail connections for cron sync.';

NOTIFY pgrst, 'reload schema';
