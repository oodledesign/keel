-- Campaigns Growth/Pro add-on: send packs, contact bumps, saved lists,
-- A/B subjects, automations, schedule timezone, and a Circulation meter stub
-- that MUST stay separate from campaign_credit_pools.
--
-- Apply in production with the usual migration runner (do not supabase db push).

-- ---------------------------------------------------------------------------
-- campaign_credit_pools: contact bonus from recurring bumps
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaign_credit_pools
  ADD COLUMN IF NOT EXISTS contact_bonus integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_credit_pools
  DROP CONSTRAINT IF EXISTS campaign_credit_pools_contact_bonus_nonneg;

ALTER TABLE public.campaign_credit_pools
  ADD CONSTRAINT campaign_credit_pools_contact_bonus_nonneg
  CHECK (contact_bonus >= 0);

COMMENT ON COLUMN public.campaign_credit_pools.contact_bonus IS
  'Extra contact cap from recurring bump subscriptions. Effective cap = max_contacts (plan + bonus).';

COMMENT ON TABLE public.campaign_credit_pools IS
  'Campaign send-unit debit pool. Monthly allotment is granted on invoice.paid as a monthly_grant batch that expires at cycle_end. Unused monthly units do not roll. Packs stack as extra batches. Never used for commercial Circulation.';

-- ---------------------------------------------------------------------------
-- campaign_credit_batches / transactions: pack source types
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaign_credit_batches
  DROP CONSTRAINT IF EXISTS campaign_credit_batches_source_type_check;

ALTER TABLE public.campaign_credit_batches
  ADD CONSTRAINT campaign_credit_batches_source_type_check
  CHECK (
    source_type IN (
      'monthly_grant',
      'admin_grant',
      'topup_purchase',
      'pack_recurring'
    )
  );

ALTER TABLE public.campaign_credit_transactions
  DROP CONSTRAINT IF EXISTS campaign_credit_transactions_type_check;

ALTER TABLE public.campaign_credit_transactions
  ADD CONSTRAINT campaign_credit_transactions_type_check
  CHECK (
    type IN (
      'monthly_grant',
      'admin_grant',
      'topup_purchase',
      'pack_recurring',
      'send_debit',
      'refund',
      'expiry'
    )
  );

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

  IF p_source_type NOT IN (
    'monthly_grant',
    'admin_grant',
    'topup_purchase',
    'pack_recurring'
  ) THEN
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
-- A/B subjects + schedule timezone on campaigns
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS subject_b text,
  ADD COLUMN IF NOT EXISTS ab_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_split_percent integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS scheduled_timezone text NOT NULL DEFAULT 'Europe/London';

ALTER TABLE public.workspace_email_campaigns
  DROP CONSTRAINT IF EXISTS workspace_email_campaigns_subject_b_len;

ALTER TABLE public.workspace_email_campaigns
  ADD CONSTRAINT workspace_email_campaigns_subject_b_len
  CHECK (subject_b IS NULL OR char_length(subject_b) <= 300);

ALTER TABLE public.workspace_email_campaigns
  DROP CONSTRAINT IF EXISTS workspace_email_campaigns_ab_split_check;

ALTER TABLE public.workspace_email_campaigns
  ADD CONSTRAINT workspace_email_campaigns_ab_split_check
  CHECK (ab_split_percent BETWEEN 10 AND 90);

COMMENT ON COLUMN public.workspace_email_campaigns.ab_enabled IS
  'Growth+: split-send subject A/B. subject is variant A; subject_b is variant B.';

ALTER TABLE public.workspace_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS ab_variant text;

ALTER TABLE public.workspace_email_campaign_recipients
  DROP CONSTRAINT IF EXISTS workspace_email_campaign_recipients_ab_variant_check;

ALTER TABLE public.workspace_email_campaign_recipients
  ADD CONSTRAINT workspace_email_campaign_recipients_ab_variant_check
  CHECK (ab_variant IS NULL OR ab_variant IN ('a', 'b'));

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_recipients_ab
  ON public.workspace_email_campaign_recipients (campaign_id, ab_variant)
  WHERE ab_variant IS NOT NULL;

-- Saved lists as an audience source
ALTER TABLE public.workspace_email_campaigns
  DROP CONSTRAINT IF EXISTS workspace_email_campaigns_audience_type_check;

ALTER TABLE public.workspace_email_campaigns
  ADD CONSTRAINT workspace_email_campaigns_audience_type_check
  CHECK (
    audience_type IN ('subscribers', 'clients', 'contacts', 'custom', 'list')
  );

-- ---------------------------------------------------------------------------
-- Saved audience lists + logic filters (Growth+)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_audience_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  source text NOT NULL DEFAULT 'subscribers',
  match_mode text NOT NULL DEFAULT 'all',
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_audience_lists_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT campaign_audience_lists_source_check CHECK (
    source IN ('subscribers', 'clients', 'contacts')
  ),
  CONSTRAINT campaign_audience_lists_match_check CHECK (
    match_mode IN ('all', 'any')
  )
);

COMMENT ON TABLE public.campaign_audience_lists IS
  'Growth+: named audience lists with v1 logic filters. Resolved at send time.';

CREATE INDEX IF NOT EXISTS ix_campaign_audience_lists_account
  ON public.campaign_audience_lists (account_id, created_at DESC);

DROP TRIGGER IF EXISTS campaign_audience_lists_set_timestamps
  ON public.campaign_audience_lists;
CREATE TRIGGER campaign_audience_lists_set_timestamps
BEFORE INSERT OR UPDATE ON public.campaign_audience_lists
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.campaign_audience_lists ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_audience_lists FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_audience_lists
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_audience_lists_select ON public.campaign_audience_lists;
CREATE POLICY campaign_audience_lists_select ON public.campaign_audience_lists
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_lists_insert ON public.campaign_audience_lists;
CREATE POLICY campaign_audience_lists_insert ON public.campaign_audience_lists
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_lists_update ON public.campaign_audience_lists;
CREATE POLICY campaign_audience_lists_update ON public.campaign_audience_lists
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_lists_delete ON public.campaign_audience_lists;
CREATE POLICY campaign_audience_lists_delete ON public.campaign_audience_lists
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_lists_service_role ON public.campaign_audience_lists;
CREATE POLICY campaign_audience_lists_service_role ON public.campaign_audience_lists
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Simple automations (Growth+): welcome / new subscriber → campaign email
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'new_subscriber',
  campaign_id uuid REFERENCES public.workspace_email_campaigns (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'paused',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_automations_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT campaign_automations_trigger_check CHECK (
    trigger_type IN ('new_subscriber')
  ),
  CONSTRAINT campaign_automations_status_check CHECK (
    status IN ('active', 'paused')
  )
);

COMMENT ON TABLE public.campaign_automations IS
  'Growth+ v1 automations. new_subscriber sends the linked campaign as a one-off welcome.';

CREATE INDEX IF NOT EXISTS ix_campaign_automations_account
  ON public.campaign_automations (account_id, status);

CREATE INDEX IF NOT EXISTS ix_campaign_automations_trigger
  ON public.campaign_automations (account_id, trigger_type)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS campaign_automations_set_timestamps
  ON public.campaign_automations;
CREATE TRIGGER campaign_automations_set_timestamps
BEFORE INSERT OR UPDATE ON public.campaign_automations
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.campaign_automations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_automations FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_automations
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_automations_select ON public.campaign_automations;
CREATE POLICY campaign_automations_select ON public.campaign_automations
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_automations_insert ON public.campaign_automations;
CREATE POLICY campaign_automations_insert ON public.campaign_automations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_automations_update ON public.campaign_automations;
CREATE POLICY campaign_automations_update ON public.campaign_automations
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_automations_delete ON public.campaign_automations;
CREATE POLICY campaign_automations_delete ON public.campaign_automations
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_automations_service_role ON public.campaign_automations;
CREATE POLICY campaign_automations_service_role ON public.campaign_automations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.campaign_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.campaign_automations (id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.workspace_email_campaigns (id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  ses_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_automation_runs_status_check CHECK (
    status IN ('pending', 'sent', 'failed', 'skipped')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_campaign_automation_runs_once
  ON public.campaign_automation_runs (automation_id, email);

CREATE INDEX IF NOT EXISTS ix_campaign_automation_runs_account
  ON public.campaign_automation_runs (account_id, created_at DESC);

ALTER TABLE public.campaign_automation_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_automation_runs FROM anon, authenticated, service_role;
GRANT SELECT ON public.campaign_automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_automation_runs TO service_role;

DROP POLICY IF EXISTS campaign_automation_runs_select ON public.campaign_automation_runs;
CREATE POLICY campaign_automation_runs_select ON public.campaign_automation_runs
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_automation_runs_service_role ON public.campaign_automation_runs;
CREATE POLICY campaign_automation_runs_service_role ON public.campaign_automation_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Circulation included allowance stub (NOT the campaigns pool)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circulation_credit_pools (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  emails_sent integer NOT NULL DEFAULT 0,
  monthly_allowance integer NOT NULL DEFAULT 1000,
  max_contacts integer NOT NULL DEFAULT 250,
  cycle_start date,
  cycle_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circulation_credit_pools_emails_nonneg CHECK (emails_sent >= 0),
  CONSTRAINT circulation_credit_pools_allowance_nonneg CHECK (monthly_allowance >= 0),
  CONSTRAINT circulation_credit_pools_contacts_nonneg CHECK (max_contacts >= 0)
);

COMMENT ON TABLE public.circulation_credit_pools IS
  'Commercial Circulation included allowance stub (250 contacts / 1,000 emails/mo). Separate from campaign_credit_pools. Packs can follow later.';

DROP TRIGGER IF EXISTS circulation_credit_pools_set_timestamps
  ON public.circulation_credit_pools;
CREATE TRIGGER circulation_credit_pools_set_timestamps
BEFORE INSERT OR UPDATE ON public.circulation_credit_pools
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.circulation_credit_pools ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.circulation_credit_pools FROM anon, authenticated, service_role;
GRANT SELECT ON public.circulation_credit_pools TO authenticated;
GRANT ALL ON public.circulation_credit_pools TO service_role;

DROP POLICY IF EXISTS circulation_credit_pools_select ON public.circulation_credit_pools;
CREATE POLICY circulation_credit_pools_select ON public.circulation_credit_pools
  FOR SELECT TO authenticated
  USING (
    public.is_account_member(account_id)
    OR public.is_super_admin()
  );

CREATE OR REPLACE FUNCTION public.ensure_circulation_credit_pool(p_account_id uuid)
RETURNS public.circulation_credit_pools
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.circulation_credit_pools;
BEGIN
  INSERT INTO public.circulation_credit_pools (account_id)
  VALUES (p_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.circulation_credit_pools
  WHERE account_id = p_account_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_circulation_credit_pool(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_circulation_credit_pool(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
