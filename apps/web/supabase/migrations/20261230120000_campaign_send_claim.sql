-- Campaign send leases.
--
-- Apply this migration manually in production before the matching app deploy.
-- A recipient stays `pending` while a worker holds it. claim_token + claim_expires_at
-- are the lease. Expired leases can be claimed again. A campaign-level
-- send_locked_until (one active drain for the whole SES account) keeps parallel
-- workers from exceeding the account send rate.

ALTER TABLE public.workspace_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS send_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS credits_debited_at timestamptz;

-- Campaigns already in flight were debited by the previous sender. New sends
-- set this only after debit_campaign_credits succeeds, so a cron tick cannot
-- mail a snapshot that has not been paid for yet.
UPDATE public.workspace_email_campaigns
SET credits_debited_at = COALESCE(updated_at, now())
WHERE status = 'sending'
  AND credits_debited_at IS NULL;

COMMENT ON COLUMN public.workspace_email_campaign_recipients.claim_token IS
  'Worker lease token. Status updates must match this token.';

COMMENT ON COLUMN public.workspace_email_campaign_recipients.claim_expires_at IS
  'Lease expiry. Null or in the past means the pending row can be claimed. A future time also backs off a throttled row.';

COMMENT ON COLUMN public.workspace_email_campaigns.send_locked_until IS
  'While in the future, no other campaign drain may send. Released when a worker finishes its budget.';

COMMENT ON COLUMN public.workspace_email_campaigns.credits_debited_at IS
  'Set after send units are debited. Workers must not mail while this is null.';

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_recipients_pending_claim
  ON public.workspace_email_campaign_recipients (campaign_id, created_at, id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.acquire_campaign_send_lock(
  p_campaign_id uuid,
  p_account_id uuid,
  p_lock_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seconds integer := greatest(30, least(COALESCE(p_lock_seconds, 260), 360));
  v_updated uuid;
BEGIN
  -- One SES account is shared. Serialize lock acquisition so two campaigns
  -- cannot both observe a free lock and send at once.
  PERFORM pg_advisory_xact_lock(hashtextextended('ozer:campaign-ses-send', 0));

  UPDATE public.workspace_email_campaigns AS campaign
  SET send_locked_until = now() + make_interval(secs => v_seconds)
  WHERE campaign.id = p_campaign_id
    AND campaign.account_id = p_account_id
    AND campaign.status = 'sending'
    AND (
      campaign.send_locked_until IS NULL
      OR campaign.send_locked_until < now()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_email_campaigns AS other
      WHERE other.id <> p_campaign_id
        AND other.send_locked_until IS NOT NULL
        AND other.send_locked_until > now()
    )
  RETURNING campaign.id INTO v_updated;

  RETURN v_updated IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_campaign_send_lock(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_campaign_send_lock(uuid, uuid, integer)
  TO service_role;

COMMENT ON FUNCTION public.acquire_campaign_send_lock(uuid, uuid, integer) IS
  'Takes the platform campaign send lock for one sending campaign. False when another drain is active.';

CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(
  p_campaign_id uuid,
  p_account_id uuid,
  p_limit integer,
  p_lease_seconds integer,
  p_claim_token text
)
RETURNS TABLE (
  recipient_id uuid,
  recipient_email text,
  recipient_display_name text,
  recipient_preference_id uuid,
  recipient_unsubscribe_token text,
  recipient_ab_variant text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := greatest(1, least(COALESCE(p_limit, 50), 500));
  v_lease integer := greatest(15, least(COALESCE(p_lease_seconds, 90), 300));
BEGIN
  IF p_claim_token IS NULL OR length(btrim(p_claim_token)) = 0 THEN
    RAISE EXCEPTION 'claim token is required';
  END IF;

  RETURN QUERY
  WITH next_rows AS (
    SELECT recipient.id
    FROM public.workspace_email_campaign_recipients AS recipient
    WHERE recipient.campaign_id = p_campaign_id
      AND recipient.account_id = p_account_id
      AND recipient.status = 'pending'
      AND (
        recipient.claim_expires_at IS NULL
        OR recipient.claim_expires_at < now()
      )
    ORDER BY recipient.created_at ASC, recipient.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  ),
  claimed AS (
    UPDATE public.workspace_email_campaign_recipients AS recipient
    SET
      claim_token = p_claim_token,
      claim_expires_at = now() + make_interval(secs => v_lease)
    FROM next_rows
    WHERE recipient.id = next_rows.id
    RETURNING
      recipient.id,
      recipient.email,
      recipient.display_name,
      recipient.preference_id,
      recipient.unsubscribe_token,
      recipient.ab_variant
  )
  SELECT
    claimed.id,
    claimed.email,
    claimed.display_name,
    claimed.preference_id,
    claimed.unsubscribe_token,
    claimed.ab_variant
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_recipients(uuid, uuid, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, uuid, integer, integer, text)
  TO service_role;

COMMENT ON FUNCTION public.claim_campaign_recipients(uuid, uuid, integer, integer, text) IS
  'Claims a wave of pending campaign recipients with FOR UPDATE SKIP LOCKED. Expired leases are reclaimable.';

CREATE OR REPLACE FUNCTION public.campaign_recipient_status_counts(
  p_campaign_id uuid,
  p_account_id uuid
)
RETURNS TABLE (
  pending_count integer,
  sent_count integer,
  failed_count integer,
  skipped_count integer,
  unsubscribed_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COUNT(*) FILTER (WHERE recipient.status = 'pending')::integer,
    COUNT(*) FILTER (WHERE recipient.status = 'sent')::integer,
    COUNT(*) FILTER (WHERE recipient.status = 'failed')::integer,
    COUNT(*) FILTER (WHERE recipient.status = 'skipped')::integer,
    COUNT(*) FILTER (WHERE recipient.unsubscribed_at IS NOT NULL)::integer
  FROM public.workspace_email_campaign_recipients AS recipient
  WHERE recipient.campaign_id = p_campaign_id
    AND recipient.account_id = p_account_id;
$$;

REVOKE ALL ON FUNCTION public.campaign_recipient_status_counts(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_recipient_status_counts(uuid, uuid)
  TO service_role;

COMMENT ON FUNCTION public.campaign_recipient_status_counts(uuid, uuid) IS
  'One-pass recipient counters for a campaign send drain.';

NOTIFY pgrst, 'reload schema';
