-- Client credit ledger RPCs: ensure, grant, consume, refund, expire.
-- SECURITY DEFINER, service_role execute only (mirrors media_credit_*).
-- Also revoke anon GraphQL exposure on Prompt 1 tables.

REVOKE ALL ON public.request_types FROM anon;
REVOKE ALL ON public.client_credit_pools FROM anon;
REVOKE ALL ON public.client_credit_batches FROM anon;
REVOKE ALL ON public.client_credit_transactions FROM anon;

-- Ensure pool row exists (balance 0).
CREATE OR REPLACE FUNCTION public.ensure_client_credit_pool(
  p_client_org_id uuid,
  p_account_id uuid
)
RETURNS public.client_credit_pools
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.client_credit_pools;
BEGIN
  IF p_client_org_id IS NULL OR p_account_id IS NULL THEN
    RAISE EXCEPTION 'client_org_id and account_id are required';
  END IF;

  INSERT INTO public.client_credit_pools (client_org_id, account_id)
  VALUES (p_client_org_id, p_account_id)
  ON CONFLICT (client_org_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.client_credit_pools
  WHERE client_org_id = p_client_org_id
  FOR UPDATE;

  IF v_row.account_id IS DISTINCT FROM p_account_id THEN
    RAISE EXCEPTION 'client_org_id is bound to a different account_id';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_client_credit_pool(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_client_credit_pool(uuid, uuid) TO service_role;

-- Grant credits into a new batch + ledger row + pool bump.
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
    'expires_at', v_batch.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_client_credits(uuid, uuid, integer, text, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_client_credits(uuid, uuid, integer, text, timestamptz, uuid) TO service_role;

-- Consume FIFO by earliest expires_at (NULLS LAST = never-expiring last).
-- Returns typed insufficient_balance instead of raising when short.
CREATE OR REPLACE FUNCTION public.consume_client_credits(
  p_client_org_id uuid,
  p_amount integer,
  p_related_ticket_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
  v_available integer := 0;
  v_remaining integer;
  v_take integer;
  v_batch record;
  v_allocations jsonb := '[]'::jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT account_id
  INTO v_account_id
  FROM public.client_credit_pools
  WHERE client_org_id = p_client_org_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'available', 0,
      'requested', p_amount
    );
  END IF;

  -- Lock spendable batches earliest-expiry first.
  PERFORM 1
  FROM public.client_credit_batches
  WHERE client_org_id = p_client_org_id
    AND units_remaining > 0
    AND swept_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY expires_at ASC NULLS LAST
  FOR UPDATE;

  SELECT COALESCE(SUM(units_remaining), 0)::integer
  INTO v_available
  FROM public.client_credit_batches
  WHERE client_org_id = p_client_org_id
    AND units_remaining > 0
    AND swept_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_available < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'available', v_available,
      'requested', p_amount
    );
  END IF;

  v_remaining := p_amount;

  FOR v_batch IN
    SELECT id, units_remaining
    FROM public.client_credit_batches
    WHERE client_org_id = p_client_org_id
      AND units_remaining > 0
      AND swept_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at ASC NULLS LAST
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_batch.units_remaining, v_remaining);

    UPDATE public.client_credit_batches
    SET units_remaining = units_remaining - v_take
    WHERE id = v_batch.id;

    INSERT INTO public.client_credit_transactions (
      client_org_id,
      account_id,
      batch_id,
      type,
      amount,
      related_ticket_id,
      actor_id
    )
    VALUES (
      p_client_org_id,
      v_account_id,
      v_batch.id,
      'consume',
      -v_take,
      p_related_ticket_id,
      p_actor_id
    );

    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('batch_id', v_batch.id, 'amount', v_take)
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'consume allocation incomplete';
  END IF;

  UPDATE public.client_credit_pools
  SET
    balance = balance - p_amount,
    updated_at = now()
  WHERE client_org_id = p_client_org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'consumed', p_amount,
    'allocations', v_allocations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_client_credits(uuid, integer, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_client_credits(uuid, integer, uuid, uuid) TO service_role;

-- Refund prior consume rows for a ticket back onto their source batches.
CREATE OR REPLACE FUNCTION public.refund_client_credits(
  p_related_ticket_id uuid,
  p_actor_id uuid DEFAULT NULL,
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
  v_expired_batch boolean := false;
  v_client_org_id uuid;
  v_account_id uuid;
BEGIN
  IF p_related_ticket_id IS NULL THEN
    RAISE EXCEPTION 'related_ticket_id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_credit_transactions
    WHERE related_ticket_id = p_related_ticket_id
      AND type = 'consume'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'refunded', 0, 'reason', 'no_consumes');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_credit_transactions
    WHERE related_ticket_id = p_related_ticket_id
      AND type = 'refund'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'refunded', 0, 'reason', 'already_refunded');
  END IF;

  FOR v_tx IN
    SELECT *
    FROM public.client_credit_transactions
    WHERE related_ticket_id = p_related_ticket_id
      AND type = 'consume'
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    v_client_org_id := v_tx.client_org_id;
    v_account_id := v_tx.account_id;

    DECLARE
      v_units integer := ABS(v_tx.amount);
      v_batch_alive boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM public.client_credit_batches b
        WHERE b.id = v_tx.batch_id
          AND b.swept_at IS NULL
      )
      INTO v_batch_alive;

      IF v_tx.batch_id IS NOT NULL AND v_batch_alive THEN
        UPDATE public.client_credit_batches
        SET units_remaining = units_remaining + v_units
        WHERE id = v_tx.batch_id;
      ELSE
        v_expired_batch := true;
      END IF;

      INSERT INTO public.client_credit_transactions (
        client_org_id,
        account_id,
        batch_id,
        type,
        amount,
        related_ticket_id,
        actor_id,
        reason
      )
      VALUES (
        v_tx.client_org_id,
        v_tx.account_id,
        v_tx.batch_id,
        'refund',
        v_units,
        p_related_ticket_id,
        p_actor_id,
        COALESCE(p_reason, 'ticket_void')
      );

      v_refunded := v_refunded + v_units;
    END;
  END LOOP;

  IF v_client_org_id IS NOT NULL AND v_refunded > 0 THEN
    UPDATE public.client_credit_pools
    SET
      balance = balance + v_refunded,
      updated_at = now()
    WHERE client_org_id = v_client_org_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'refunded', v_refunded,
    'expired_batch_edge_case', v_expired_batch,
    'account_id', v_account_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_client_credits(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_client_credits(uuid, uuid, text) TO service_role;

-- Sweep expired batches with remaining units. Safe to re-run.
CREATE OR REPLACE FUNCTION public.expire_stale_client_credit_batches()
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
    SELECT id, client_org_id, account_id, units_remaining
    FROM public.client_credit_batches
    WHERE expires_at IS NOT NULL
      AND expires_at <= now()
      AND units_remaining > 0
      AND swept_at IS NULL
    ORDER BY expires_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.client_credit_batches
    SET
      units_remaining = 0,
      swept_at = now()
    WHERE id = v_batch.id
      AND swept_at IS NULL
      AND units_remaining > 0;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.client_credit_transactions (
      client_org_id,
      account_id,
      batch_id,
      type,
      amount,
      reason
    )
    VALUES (
      v_batch.client_org_id,
      v_batch.account_id,
      v_batch.id,
      'expire',
      -v_batch.units_remaining,
      'batch_expired'
    );

    UPDATE public.client_credit_pools
    SET
      balance = GREATEST(0, balance - v_batch.units_remaining),
      updated_at = now()
    WHERE client_org_id = v_batch.client_org_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_client_credit_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_client_credit_batches() TO service_role;
