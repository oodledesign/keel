-- Email campaigns add-on: drafts, send log, and send-unit ledger.
-- Enable/disable uses account_module_settings.module_key = 'campaigns'
-- Entitlement key: addon_campaigns. Ledger writes are service_role only.
--
-- Table names are workspace_email_campaigns / workspace_email_campaign_recipients
-- so this add-on can live beside the existing admin marketing tables
-- public.email_campaigns and public.email_campaign_metrics (do not drop or alter those).

-- ---------------------------------------------------------------------------
-- workspace_email_campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preview_text text,
  html_body text NOT NULL DEFAULT '',
  from_name text,
  from_email text,
  reply_to text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'scheduled',
      'sending',
      'sent',
      'cancelled',
      'failed'
    )),
  scheduled_at timestamptz,
  sent_at timestamptz,
  audience_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  unsubscribed_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_email_campaigns_name_len CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT workspace_email_campaigns_subject_len CHECK (char_length(subject) <= 300)
);

COMMENT ON TABLE public.workspace_email_campaigns IS
  'Workspace-branded marketing campaigns. Audience is workspace_mailing_preferences subscribers.';

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaigns_account_created
  ON public.workspace_email_campaigns (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaigns_due
  ON public.workspace_email_campaigns (scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaigns_sending
  ON public.workspace_email_campaigns (account_id)
  WHERE status = 'sending';

-- ---------------------------------------------------------------------------
-- workspace_email_campaign_recipients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.workspace_email_campaigns (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  preference_id uuid REFERENCES public.workspace_mailing_preferences (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  unsubscribe_token text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  skip_reason text,
  ses_message_id text,
  error_message text,
  sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_email_campaign_recipients IS
  'Per-recipient send log for workspace_email_campaigns. Counts toward campaign send usage.';

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_recipients_campaign_status
  ON public.workspace_email_campaign_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_recipients_account_email
  ON public.workspace_email_campaign_recipients (account_id, email);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_email_campaign_recipients_campaign_email
  ON public.workspace_email_campaign_recipients (campaign_id, email);

-- ---------------------------------------------------------------------------
-- campaign_credit_pools (cached spendable send units; never write from app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_credit_pools (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  monthly_allowance integer NOT NULL DEFAULT 0,
  max_contacts integer NOT NULL DEFAULT 0,
  plan_tier text NOT NULL DEFAULT 'none',
  cycle_start date,
  cycle_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_credit_pools_balance_nonneg CHECK (balance >= 0),
  CONSTRAINT campaign_credit_pools_allowance_nonneg CHECK (monthly_allowance >= 0),
  CONSTRAINT campaign_credit_pools_contacts_nonneg CHECK (max_contacts >= 0)
);

COMMENT ON TABLE public.campaign_credit_pools IS
  'Cached sum of spendable campaign send units. max_contacts is the billed list-size cap (0 = unlimited for admin grants).';

DROP TRIGGER IF EXISTS campaign_credit_pools_set_timestamps ON public.campaign_credit_pools;
CREATE TRIGGER campaign_credit_pools_set_timestamps
BEFORE INSERT OR UPDATE ON public.campaign_credit_pools
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- campaign_credit_batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_credit_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  units_granted integer NOT NULL,
  units_remaining integer NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  swept_at timestamptz,
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_credit_batches_source_type_check CHECK (
    source_type IN ('monthly_grant', 'admin_grant')
  ),
  CONSTRAINT campaign_credit_batches_units_granted_pos CHECK (units_granted > 0),
  CONSTRAINT campaign_credit_batches_units_remaining_nonneg CHECK (units_remaining >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_campaign_credit_batches_stripe_event_id
  ON public.campaign_credit_batches (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_campaign_credit_batches_spendable
  ON public.campaign_credit_batches (account_id, expires_at)
  WHERE units_remaining > 0 AND swept_at IS NULL;

-- ---------------------------------------------------------------------------
-- campaign_credit_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.campaign_credit_batches (id) ON DELETE SET NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  related_campaign_id uuid REFERENCES public.workspace_email_campaigns (id) ON DELETE SET NULL,
  stripe_event_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_credit_transactions_type_check CHECK (
    type IN (
      'monthly_grant',
      'admin_grant',
      'send_debit',
      'refund',
      'expiry'
    )
  )
);

COMMENT ON TABLE public.campaign_credit_transactions IS
  'Immutable campaign send-unit ledger. Debits may span multiple rows (one per batch).';

CREATE INDEX IF NOT EXISTS ix_campaign_credit_transactions_account_created
  ON public.campaign_credit_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_campaign_credit_transactions_campaign
  ON public.campaign_credit_transactions (related_campaign_id)
  WHERE related_campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_credit_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_credit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_credit_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_email_campaigns FROM anon, authenticated, service_role;
REVOKE ALL ON public.workspace_email_campaign_recipients FROM anon, authenticated, service_role;
REVOKE ALL ON public.campaign_credit_pools FROM anon, authenticated, service_role;
REVOKE ALL ON public.campaign_credit_batches FROM anon, authenticated, service_role;
REVOKE ALL ON public.campaign_credit_transactions FROM anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_email_campaigns
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_email_campaign_recipients
  TO authenticated, service_role;
GRANT SELECT ON public.campaign_credit_pools TO authenticated;
GRANT SELECT ON public.campaign_credit_batches TO authenticated;
GRANT SELECT ON public.campaign_credit_transactions TO authenticated;
GRANT ALL ON public.campaign_credit_pools TO service_role;
GRANT ALL ON public.campaign_credit_batches TO service_role;
GRANT ALL ON public.campaign_credit_transactions TO service_role;

DROP POLICY IF EXISTS workspace_email_campaigns_select ON public.workspace_email_campaigns;
CREATE POLICY workspace_email_campaigns_select ON public.workspace_email_campaigns
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaigns_insert ON public.workspace_email_campaigns;
CREATE POLICY workspace_email_campaigns_insert ON public.workspace_email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaigns_update ON public.workspace_email_campaigns;
CREATE POLICY workspace_email_campaigns_update ON public.workspace_email_campaigns
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaigns_delete ON public.workspace_email_campaigns;
CREATE POLICY workspace_email_campaigns_delete ON public.workspace_email_campaigns
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaigns_service_role ON public.workspace_email_campaigns;
CREATE POLICY workspace_email_campaigns_service_role ON public.workspace_email_campaigns
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS workspace_email_campaign_recipients_select ON public.workspace_email_campaign_recipients;
CREATE POLICY workspace_email_campaign_recipients_select ON public.workspace_email_campaign_recipients
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_recipients_insert ON public.workspace_email_campaign_recipients;
CREATE POLICY workspace_email_campaign_recipients_insert ON public.workspace_email_campaign_recipients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_recipients_update ON public.workspace_email_campaign_recipients;
CREATE POLICY workspace_email_campaign_recipients_update ON public.workspace_email_campaign_recipients
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_recipients_delete ON public.workspace_email_campaign_recipients;
CREATE POLICY workspace_email_campaign_recipients_delete ON public.workspace_email_campaign_recipients
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_email_campaign_recipients_service_role ON public.workspace_email_campaign_recipients;
CREATE POLICY workspace_email_campaign_recipients_service_role ON public.workspace_email_campaign_recipients
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS campaign_credit_pools_select ON public.campaign_credit_pools;
CREATE POLICY campaign_credit_pools_select ON public.campaign_credit_pools
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS campaign_credit_batches_select ON public.campaign_credit_batches;
CREATE POLICY campaign_credit_batches_select ON public.campaign_credit_batches
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS campaign_credit_transactions_select ON public.campaign_credit_transactions;
CREATE POLICY campaign_credit_transactions_select ON public.campaign_credit_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    OR public.is_super_admin()
  );

CREATE OR REPLACE FUNCTION public.set_workspace_email_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_email_campaigns_set_updated_at ON public.workspace_email_campaigns;
CREATE TRIGGER workspace_email_campaigns_set_updated_at
  BEFORE UPDATE ON public.workspace_email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_email_campaigns_updated_at();

-- ---------------------------------------------------------------------------
-- Ledger RPCs (service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_campaign_credit_pool(p_account_id uuid)
RETURNS public.campaign_credit_pools
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.campaign_credit_pools;
BEGIN
  INSERT INTO public.campaign_credit_pools (account_id)
  VALUES (p_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.campaign_credit_pools
  WHERE account_id = p_account_id
  FOR UPDATE;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_campaign_credit_pool(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_credit_pool(uuid) TO service_role;

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

  IF p_source_type NOT IN ('monthly_grant', 'admin_grant') THEN
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

CREATE OR REPLACE FUNCTION public.debit_campaign_credits(
  p_account_id uuid,
  p_amount integer,
  p_campaign_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_available integer := 0;
  v_remaining integer;
  v_take integer;
  v_batch record;
  v_allocations jsonb := '[]'::jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  PERFORM public.ensure_campaign_credit_pool(p_account_id);

  PERFORM 1
  FROM public.campaign_credit_batches
  WHERE account_id = p_account_id
    AND units_remaining > 0
    AND swept_at IS NULL
    AND expires_at > now()
  ORDER BY expires_at ASC
  FOR UPDATE;

  SELECT COALESCE(SUM(units_remaining), 0)::integer
  INTO v_available
  FROM public.campaign_credit_batches
  WHERE account_id = p_account_id
    AND units_remaining > 0
    AND swept_at IS NULL
    AND expires_at > now();

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CAMPAIGN_CREDITS:%:%', v_available, p_amount
      USING ERRCODE = 'P0001';
  END IF;

  v_remaining := p_amount;

  FOR v_batch IN
    SELECT id, units_remaining
    FROM public.campaign_credit_batches
    WHERE account_id = p_account_id
      AND units_remaining > 0
      AND swept_at IS NULL
      AND expires_at > now()
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_batch.units_remaining, v_remaining);

    UPDATE public.campaign_credit_batches
    SET units_remaining = units_remaining - v_take
    WHERE id = v_batch.id;

    INSERT INTO public.campaign_credit_transactions (
      account_id,
      batch_id,
      type,
      amount,
      related_campaign_id
    )
    VALUES (
      p_account_id,
      v_batch.id,
      'send_debit',
      -v_take,
      p_campaign_id
    );

    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('batch_id', v_batch.id, 'amount', v_take)
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'debit allocation incomplete';
  END IF;

  UPDATE public.campaign_credit_pools
  SET
    balance = balance - p_amount,
    updated_at = now()
  WHERE account_id = p_account_id;

  RETURN jsonb_build_object(
    'debited', p_amount,
    'allocations', v_allocations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.debit_campaign_credits(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_campaign_credits(uuid, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_campaign_credits(
  p_campaign_id uuid,
  p_amount integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx record;
  v_refunded integer := 0;
  v_needed integer;
  v_take integer;
  v_account_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('refunded', 0, 'reason', 'zero_amount');
  END IF;

  v_needed := p_amount;

  FOR v_tx IN
    SELECT *
    FROM public.campaign_credit_transactions
    WHERE related_campaign_id = p_campaign_id
      AND type = 'send_debit'
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_needed <= 0;
    v_account_id := v_tx.account_id;
    v_take := LEAST(ABS(v_tx.amount), v_needed);

    IF v_tx.batch_id IS NOT NULL THEN
      UPDATE public.campaign_credit_batches
      SET units_remaining = units_remaining + v_take
      WHERE id = v_tx.batch_id
        AND swept_at IS NULL;
    END IF;

    INSERT INTO public.campaign_credit_transactions (
      account_id,
      batch_id,
      type,
      amount,
      related_campaign_id,
      reason
    )
    VALUES (
      v_tx.account_id,
      v_tx.batch_id,
      'refund',
      v_take,
      p_campaign_id,
      COALESCE(p_reason, 'unused_sends')
    );

    v_refunded := v_refunded + v_take;
    v_needed := v_needed - v_take;
  END LOOP;

  IF v_account_id IS NOT NULL AND v_refunded > 0 THEN
    UPDATE public.campaign_credit_pools
    SET
      balance = balance + v_refunded,
      updated_at = now()
    WHERE account_id = v_account_id;
  END IF;

  RETURN jsonb_build_object(
    'refunded', v_refunded,
    'reason', CASE WHEN v_needed > 0 THEN 'partial' ELSE 'ok' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_campaign_credits(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_campaign_credits(uuid, integer, text) TO service_role;

NOTIFY pgrst, 'reload schema';
