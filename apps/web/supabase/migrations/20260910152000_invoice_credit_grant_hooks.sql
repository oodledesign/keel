-- Prompt 3 scaffolding: invoice metadata for credit grants, link series↔
-- subscription, idempotent grant-on-invoice uniqueness.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.invoices.metadata IS
  'Extensible invoice metadata. Credit top-ups use credit_topup_units / credit_grant_source; retainer grants may include plan_template_id.';

ALTER TABLE public.invoice_recurring_series
  ADD COLUMN IF NOT EXISTS client_subscription_id uuid
    REFERENCES public.client_subscriptions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invoice_recurring_series.client_subscription_id IS
  'Optional link to client_subscriptions when the series bills a retainer/hosting plan (native invoice path).';

CREATE INDEX IF NOT EXISTS ix_invoice_recurring_series_client_subscription_id
  ON public.invoice_recurring_series (client_subscription_id)
  WHERE client_subscription_id IS NOT NULL;

-- One credit grant batch per invoice (retainer or top-up).
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_credit_batches_related_invoice
  ON public.client_credit_batches (related_invoice_id)
  WHERE related_invoice_id IS NOT NULL;

-- Make grant_client_credits idempotent on related_invoice_id.
CREATE OR REPLACE FUNCTION public.grant_client_credits(
  p_client_org_id uuid,
  p_account_id uuid,
  p_amount integer,
  p_source_type text,
  p_expires_at timestamptz DEFAULT NULL,
  p_related_invoice_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch public.client_credit_batches;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF p_source_type NOT IN ('retainer_grant', 'topup_purchase', 'manual_adjustment') THEN
    RAISE EXCEPTION 'invalid source_type: %', p_source_type;
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future when set';
  END IF;

  IF p_related_invoice_id IS NOT NULL THEN
    SELECT *
    INTO v_batch
    FROM public.client_credit_batches
    WHERE related_invoice_id = p_related_invoice_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'batch_id', v_batch.id,
        'granted', v_batch.units_granted,
        'expires_at', v_batch.expires_at,
        'idempotent', true
      );
    END IF;
  END IF;

  PERFORM public.ensure_client_credit_pool(p_client_org_id, p_account_id);

  INSERT INTO public.client_credit_batches (
    client_org_id,
    account_id,
    source_type,
    units_granted,
    units_remaining,
    related_invoice_id,
    expires_at
  )
  VALUES (
    p_client_org_id,
    p_account_id,
    p_source_type,
    p_amount,
    p_amount,
    p_related_invoice_id,
    p_expires_at
  )
  RETURNING * INTO v_batch;

  INSERT INTO public.client_credit_transactions (
    client_org_id,
    account_id,
    batch_id,
    type,
    amount,
    related_invoice_id,
    reason
  )
  VALUES (
    p_client_org_id,
    p_account_id,
    v_batch.id,
    'grant',
    p_amount,
    p_related_invoice_id,
    p_source_type
  );

  UPDATE public.client_credit_pools
  SET
    balance = balance + p_amount,
    updated_at = now()
  WHERE client_org_id = p_client_org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'granted', p_amount,
    'expires_at', v_batch.expires_at,
    'idempotent', false
  );
END;
$$;

-- Clamp pool balance down to cap (rollover_policy = cap). Excess taken from
-- latest-expiring / non-expiring batches first so older batches stay usable.
CREATE OR REPLACE FUNCTION public.clamp_client_credit_balance(
  p_client_org_id uuid,
  p_cap integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
  v_excess integer;
  v_take integer;
  v_batch record;
  v_account_id uuid;
  v_removed integer := 0;
BEGIN
  IF p_cap IS NULL OR p_cap < 0 THEN
    RAISE EXCEPTION 'cap must be >= 0';
  END IF;

  SELECT balance, account_id
  INTO v_balance, v_account_id
  FROM public.client_credit_pools
  WHERE client_org_id = p_client_org_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_balance <= p_cap THEN
    RETURN 0;
  END IF;

  v_excess := v_balance - p_cap;

  FOR v_batch IN
    SELECT id, units_remaining
    FROM public.client_credit_batches
    WHERE client_org_id = p_client_org_id
      AND units_remaining > 0
      AND swept_at IS NULL
    ORDER BY expires_at DESC NULLS FIRST, granted_at DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_excess <= 0;
    v_take := LEAST(v_batch.units_remaining, v_excess);

    UPDATE public.client_credit_batches
    SET units_remaining = units_remaining - v_take
    WHERE id = v_batch.id;

    INSERT INTO public.client_credit_transactions (
      client_org_id,
      account_id,
      batch_id,
      type,
      amount,
      reason
    )
    VALUES (
      p_client_org_id,
      v_account_id,
      v_batch.id,
      'expire',
      -v_take,
      'rollover_cap_clamp'
    );

    v_excess := v_excess - v_take;
    v_removed := v_removed + v_take;
  END LOOP;

  UPDATE public.client_credit_pools
  SET
    balance = GREATEST(0, balance - v_removed),
    updated_at = now()
  WHERE client_org_id = p_client_org_id;

  RETURN v_removed;
END;
$$;

REVOKE ALL ON FUNCTION public.clamp_client_credit_balance(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clamp_client_credit_balance(uuid, integer) TO service_role;
