-- Prefer least-recently-synced mailboxes when claiming Gmail cron batches.

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
    LEFT JOIN public.email_assistant_settings settings
      ON settings.user_id = connection.user_id
    ORDER BY settings.last_synced_at ASC NULLS FIRST,
             connection.updated_at ASC NULLS FIRST
    FOR UPDATE OF connection SKIP LOCKED
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

COMMENT ON FUNCTION public.claim_gmail_sync_batch(integer) IS
  'Atomically claims the least-recently-synced Gmail connections for cron sync.';

NOTIFY pgrst, 'reload schema';
