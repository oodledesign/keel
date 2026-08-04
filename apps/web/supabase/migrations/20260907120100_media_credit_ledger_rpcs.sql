-- Media credit ledger RPCs: grant, debit, refund, expire.
-- All SECURITY DEFINER, service_role execute only.

-- Ensure pool row exists (balance 0).
CREATE OR REPLACE FUNCTION public.ensure_media_credit_pool(p_account_id uuid)
RETURNS public.media_credit_pools
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.media_credit_pools;
BEGIN
  INSERT INTO public.media_credit_pools (account_id)
  VALUES (p_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.media_credit_pools
  WHERE account_id = p_account_id
  FOR UPDATE;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_media_credit_pool(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_media_credit_pool(uuid) TO service_role;

-- Grant credits (idempotent on stripe_event_id when provided).
CREATE OR REPLACE FUNCTION public.grant_media_credits(
  p_account_id uuid,
  p_amount integer,
  p_source_type text,
  p_expires_at timestamptz,
  p_stripe_event_id text DEFAULT NULL
)
RETURNS public.media_credit_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch public.media_credit_batches;
  v_tx_type text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF p_source_type NOT IN ('monthly_grant', 'topup_purchase') THEN
    RAISE EXCEPTION 'invalid source_type: %', p_source_type;
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;

  -- Idempotency: return existing batch for this stripe event.
  IF p_stripe_event_id IS NOT NULL THEN
    SELECT *
    INTO v_batch
    FROM public.media_credit_batches
    WHERE stripe_event_id = p_stripe_event_id;

    IF FOUND THEN
      RETURN v_batch;
    END IF;
  END IF;

  PERFORM public.ensure_media_credit_pool(p_account_id);

  INSERT INTO public.media_credit_batches (
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

  v_tx_type := p_source_type;

  INSERT INTO public.media_credit_transactions (
    account_id,
    batch_id,
    type,
    amount,
    stripe_event_id
  )
  VALUES (
    p_account_id,
    v_batch.id,
    v_tx_type,
    p_amount,
    p_stripe_event_id
  );

  UPDATE public.media_credit_pools
  SET
    balance = balance + p_amount,
    updated_at = now()
  WHERE account_id = p_account_id;

  RETURN v_batch;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_media_credits(uuid, integer, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_media_credits(uuid, integer, text, timestamptz, text) TO service_role;

-- Debit credits FIFO by earliest expires_at. Atomic; no partial debit.
CREATE OR REPLACE FUNCTION public.debit_media_credits(
  p_account_id uuid,
  p_amount integer,
  p_job_id uuid
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

  PERFORM public.ensure_media_credit_pool(p_account_id);

  -- Lock spendable batches earliest-expiry first, then sum under the lock.
  PERFORM 1
  FROM public.media_credit_batches
  WHERE account_id = p_account_id
    AND units_remaining > 0
    AND swept_at IS NULL
    AND expires_at > now()
  ORDER BY expires_at ASC
  FOR UPDATE;

  SELECT COALESCE(SUM(units_remaining), 0)::integer
  INTO v_available
  FROM public.media_credit_batches
  WHERE account_id = p_account_id
    AND units_remaining > 0
    AND swept_at IS NULL
    AND expires_at > now();

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_MEDIA_CREDITS:%:%', v_available, p_amount
      USING ERRCODE = 'P0001';
  END IF;

  v_remaining := p_amount;

  FOR v_batch IN
    SELECT id, units_remaining
    FROM public.media_credit_batches
    WHERE account_id = p_account_id
      AND units_remaining > 0
      AND swept_at IS NULL
      AND expires_at > now()
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_batch.units_remaining, v_remaining);

    UPDATE public.media_credit_batches
    SET units_remaining = units_remaining - v_take
    WHERE id = v_batch.id;

    INSERT INTO public.media_credit_transactions (
      account_id,
      batch_id,
      type,
      amount,
      related_job_id
    )
    VALUES (
      p_account_id,
      v_batch.id,
      'generation_debit',
      -v_take,
      p_job_id
    );

    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('batch_id', v_batch.id, 'amount', v_take)
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'debit allocation incomplete';
  END IF;

  UPDATE public.media_credit_pools
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

REVOKE ALL ON FUNCTION public.debit_media_credits(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_media_credits(uuid, integer, uuid) TO service_role;

-- Refund exact batch allocations for a job's generation_debit rows.
CREATE OR REPLACE FUNCTION public.refund_media_credits(
  p_job_id uuid,
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
  v_account_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.media_credit_transactions
    WHERE related_job_id = p_job_id
      AND type = 'generation_debit'
  ) THEN
    RETURN jsonb_build_object('refunded', 0, 'reason', 'no_debits');
  END IF;

  -- Already refunded?
  IF EXISTS (
    SELECT 1
    FROM public.media_credit_transactions
    WHERE related_job_id = p_job_id
      AND type = 'refund'
  ) THEN
    RETURN jsonb_build_object('refunded', 0, 'reason', 'already_refunded');
  END IF;

  FOR v_tx IN
    SELECT *
    FROM public.media_credit_transactions
    WHERE related_job_id = p_job_id
      AND type = 'generation_debit'
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    v_account_id := v_tx.account_id;
    -- amount on debit rows is negative; restore the absolute value.
    DECLARE
      v_units integer := ABS(v_tx.amount);
      v_batch_alive boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM public.media_credit_batches b
        WHERE b.id = v_tx.batch_id
          AND b.swept_at IS NULL
      )
      INTO v_batch_alive;

      IF v_tx.batch_id IS NOT NULL AND v_batch_alive THEN
        UPDATE public.media_credit_batches
        SET units_remaining = units_remaining + v_units
        WHERE id = v_tx.batch_id;
      ELSE
        -- Edge case: original batch expired/swept — restore pool balance only.
        -- Worth a manual look rather than silent handling.
        v_expired_batch := true;
      END IF;

      INSERT INTO public.media_credit_transactions (
        account_id,
        batch_id,
        type,
        amount,
        related_job_id,
        reason
      )
      VALUES (
        v_tx.account_id,
        v_tx.batch_id,
        'refund',
        v_units,
        p_job_id,
        COALESCE(p_reason, 'generation_failed')
      );

      v_refunded := v_refunded + v_units;
    END;
  END LOOP;

  IF v_account_id IS NOT NULL AND v_refunded > 0 THEN
    UPDATE public.media_credit_pools
    SET
      balance = balance + v_refunded,
      updated_at = now()
    WHERE account_id = v_account_id;
  END IF;

  RETURN jsonb_build_object(
    'refunded', v_refunded,
    'expired_batch_edge_case', v_expired_batch
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_media_credits(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_media_credits(uuid, text) TO service_role;

-- Sweep expired batches with remaining units. Safe to re-run.
CREATE OR REPLACE FUNCTION public.expire_stale_media_credit_batches()
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
    FROM public.media_credit_batches
    WHERE expires_at <= now()
      AND units_remaining > 0
      AND swept_at IS NULL
    ORDER BY expires_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.media_credit_batches
    SET
      units_remaining = 0,
      swept_at = now()
    WHERE id = v_batch.id
      AND swept_at IS NULL
      AND units_remaining > 0;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.media_credit_transactions (
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

    UPDATE public.media_credit_pools
    SET
      balance = GREATEST(0, balance - v_batch.units_remaining),
      updated_at = now()
    WHERE account_id = v_batch.account_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_media_credit_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_media_credit_batches() TO service_role;

-- Immediate forfeiture on account closure (admin_adjust).
CREATE OR REPLACE FUNCTION public.forfeit_media_credits_on_closure(p_account_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch record;
  v_total integer := 0;
BEGIN
  PERFORM public.ensure_media_credit_pool(p_account_id);

  FOR v_batch IN
    SELECT id, units_remaining
    FROM public.media_credit_batches
    WHERE account_id = p_account_id
      AND units_remaining > 0
    FOR UPDATE
  LOOP
    INSERT INTO public.media_credit_transactions (
      account_id,
      batch_id,
      type,
      amount,
      reason
    )
    VALUES (
      p_account_id,
      v_batch.id,
      'admin_adjust',
      -v_batch.units_remaining,
      'account_closure'
    );

    UPDATE public.media_credit_batches
    SET
      units_remaining = 0,
      swept_at = COALESCE(swept_at, now())
    WHERE id = v_batch.id;

    v_total := v_total + v_batch.units_remaining;
  END LOOP;

  UPDATE public.media_credit_pools
  SET
    balance = 0,
    updated_at = now()
  WHERE account_id = p_account_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.forfeit_media_credits_on_closure(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forfeit_media_credits_on_closure(uuid) TO service_role;
