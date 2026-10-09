-- Sweep expired campaign send-unit batches so the cached pool balance matches
-- what debit_campaign_credits can actually spend. Safe to re-run.
CREATE OR REPLACE FUNCTION public.expire_stale_campaign_credit_batches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch record;
  v_count integer := 0;
BEGIN
  FOR v_batch IN
    SELECT id, account_id, units_remaining
    FROM public.campaign_credit_batches
    WHERE expires_at <= now()
      AND units_remaining > 0
      AND swept_at IS NULL
    ORDER BY expires_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.campaign_credit_batches
    SET
      units_remaining = 0,
      swept_at = now()
    WHERE id = v_batch.id
      AND swept_at IS NULL
      AND units_remaining > 0;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.campaign_credit_transactions (
      account_id,
      batch_id,
      type,
      amount,
      reason
    )
    VALUES (
      v_batch.account_id,
      v_batch.id,
      'expiry',
      -v_batch.units_remaining,
      'batch_expired'
    );

    UPDATE public.campaign_credit_pools
    SET
      balance = GREATEST(0, balance - v_batch.units_remaining),
      updated_at = now()
    WHERE account_id = v_batch.account_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_campaign_credit_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_campaign_credit_batches() TO service_role;

-- Contacts counted against the Campaigns plan cap: unique people a campaign
-- has been sent to (minus anyone who unsubscribed) plus subscribed
-- mailing-list contacts.
CREATE OR REPLACE FUNCTION public.count_campaign_contacts_used(p_account_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM (
    SELECT lower(r.email) AS email
    FROM public.workspace_email_campaign_recipients r
    WHERE r.account_id = p_account_id
      AND r.sent_at IS NOT NULL
    GROUP BY lower(r.email)
    HAVING bool_and(r.unsubscribed_at IS NULL)
    UNION
    SELECT lower(p.email)
    FROM public.workspace_mailing_preferences p
    WHERE p.account_id = p_account_id
      AND p.purpose = 'workspace_mailing_list'
      AND p.marketing_status = 'subscribed'
  ) people;
$$;

REVOKE ALL ON FUNCTION public.count_campaign_contacts_used(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_campaign_contacts_used(uuid) TO service_role;
