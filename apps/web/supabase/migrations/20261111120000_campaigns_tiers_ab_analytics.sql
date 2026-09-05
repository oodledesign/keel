-- Campaigns add-on: A/B subject variants, contact-cap bumps, send top-up grants.
-- Does not merge commercial circulation into campaign_credit_pools.
--
-- Prod apply: run this file via the usual migration path
-- (`pnpm supabase:web:reset` locally, or `supabase db query` / hosted migration
-- apply). Do not use `supabase db push`.

-- ---------------------------------------------------------------------------
-- Pool: persist one-off contact bumps across billing cycles
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaign_credit_pools
  ADD COLUMN IF NOT EXISTS bonus_contacts integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_credit_pools
  DROP CONSTRAINT IF EXISTS campaign_credit_pools_bonus_contacts_nonneg;

ALTER TABLE public.campaign_credit_pools
  ADD CONSTRAINT campaign_credit_pools_bonus_contacts_nonneg
  CHECK (bonus_contacts >= 0);

COMMENT ON COLUMN public.campaign_credit_pools.bonus_contacts IS
  'Extra contact-cap from one-off bumps. Added to max_contacts unless max_contacts is 0 (unlimited).';

-- ---------------------------------------------------------------------------
-- Ledger: allow top-up batches / transactions
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaign_credit_batches
  DROP CONSTRAINT IF EXISTS campaign_credit_batches_source_type_check;

ALTER TABLE public.campaign_credit_batches
  ADD CONSTRAINT campaign_credit_batches_source_type_check
  CHECK (source_type IN ('monthly_grant', 'admin_grant', 'topup_purchase'));

ALTER TABLE public.campaign_credit_transactions
  DROP CONSTRAINT IF EXISTS campaign_credit_transactions_type_check;

ALTER TABLE public.campaign_credit_transactions
  ADD CONSTRAINT campaign_credit_transactions_type_check
  CHECK (type IN (
    'monthly_grant',
    'admin_grant',
    'topup_purchase',
    'contact_bump',
    'send_debit',
    'refund',
    'expiry'
  ));

-- ---------------------------------------------------------------------------
-- A/B subject test (Growth+) — subject only, not full content
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS ab_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subject_b text,
  ADD COLUMN IF NOT EXISTS ab_split_percent integer NOT NULL DEFAULT 50;

ALTER TABLE public.workspace_email_campaigns
  DROP CONSTRAINT IF EXISTS workspace_email_campaigns_subject_b_len;

ALTER TABLE public.workspace_email_campaigns
  ADD CONSTRAINT workspace_email_campaigns_subject_b_len
  CHECK (subject_b IS NULL OR char_length(subject_b) <= 300);

ALTER TABLE public.workspace_email_campaigns
  DROP CONSTRAINT IF EXISTS workspace_email_campaigns_ab_split_range;

ALTER TABLE public.workspace_email_campaigns
  ADD CONSTRAINT workspace_email_campaigns_ab_split_range
  CHECK (ab_split_percent BETWEEN 10 AND 90);

COMMENT ON COLUMN public.workspace_email_campaigns.ab_enabled IS
  'When true, recipients are split between subject (A) and subject_b (B).';
COMMENT ON COLUMN public.workspace_email_campaigns.ab_split_percent IS
  'Percent of audience assigned to subject A (remainder gets B).';

ALTER TABLE public.workspace_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS subject_variant text;

ALTER TABLE public.workspace_email_campaign_recipients
  DROP CONSTRAINT IF EXISTS workspace_email_campaign_recipients_subject_variant_check;

ALTER TABLE public.workspace_email_campaign_recipients
  ADD CONSTRAINT workspace_email_campaign_recipients_subject_variant_check
  CHECK (subject_variant IS NULL OR subject_variant IN ('a', 'b'));

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_recipients_variant
  ON public.workspace_email_campaign_recipients (campaign_id, subject_variant)
  WHERE subject_variant IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_email_events_campaign_at
  ON public.workspace_email_events (campaign_id, event_at)
  WHERE campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- grant_campaign_credits: accept topup_purchase
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_campaign_credits(
  p_account_id uuid,
  p_amount integer,
  p_source_type text,
  p_expires_at timestamptz,
  p_stripe_event_id text DEFAULT NULL
)
RETURNS public.campaign_credit_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch public.campaign_credit_batches;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF p_source_type NOT IN ('monthly_grant', 'admin_grant', 'topup_purchase') THEN
    RAISE EXCEPTION 'invalid source_type: %', p_source_type;
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;

  IF p_stripe_event_id IS NOT NULL THEN
    SELECT *
    INTO v_batch
    FROM public.campaign_credit_batches
    WHERE stripe_event_id = p_stripe_event_id;

    IF FOUND THEN
      RETURN v_batch;
    END IF;
  END IF;

  PERFORM public.ensure_campaign_credit_pool(p_account_id);

  INSERT INTO public.campaign_credit_batches (
    account_id,
    source_type,
    units_granted,
    units_remaining,
    expires_at,
    stripe_event_id
  )
  VALUES (
    p_account_id,
    p_source_type,
    p_amount,
    p_amount,
    p_expires_at,
    p_stripe_event_id
  )
  RETURNING * INTO v_batch;

  INSERT INTO public.campaign_credit_transactions (
    account_id,
    batch_id,
    type,
    amount,
    stripe_event_id
  )
  VALUES (
    p_account_id,
    v_batch.id,
    p_source_type,
    p_amount,
    p_stripe_event_id
  );

  UPDATE public.campaign_credit_pools
  SET
    balance = balance + p_amount,
    updated_at = now()
  WHERE account_id = p_account_id;

  RETURN v_batch;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_campaign_credits(uuid, integer, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_campaign_credits(uuid, integer, text, timestamptz, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Contact-cap bump (idempotent via stripe_event_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_campaign_contact_bump(
  p_account_id uuid,
  p_contacts integer,
  p_stripe_event_id text DEFAULT NULL
)
RETURNS public.campaign_credit_pools
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool public.campaign_credit_pools;
BEGIN
  IF p_contacts IS NULL OR p_contacts <= 0 THEN
    RAISE EXCEPTION 'contacts must be positive';
  END IF;

  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.campaign_credit_transactions
      WHERE stripe_event_id = p_stripe_event_id
        AND type = 'contact_bump'
    ) THEN
      SELECT *
      INTO v_pool
      FROM public.campaign_credit_pools
      WHERE account_id = p_account_id;
      RETURN v_pool;
    END IF;
  END IF;

  PERFORM public.ensure_campaign_credit_pool(p_account_id);

  UPDATE public.campaign_credit_pools
  SET
    bonus_contacts = bonus_contacts + p_contacts,
    updated_at = now()
  WHERE account_id = p_account_id
  RETURNING * INTO v_pool;

  INSERT INTO public.campaign_credit_transactions (
    account_id,
    type,
    amount,
    stripe_event_id,
    reason
  )
  VALUES (
    p_account_id,
    'contact_bump',
    p_contacts,
    p_stripe_event_id,
    'contact_cap_bump'
  );

  RETURN v_pool;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_campaign_contact_bump(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_campaign_contact_bump(uuid, integer, text) TO service_role;

NOTIFY pgrst, 'reload schema';
