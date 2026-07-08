-- Purchased AI credit top-ups (survive monthly reset) + purchase ledger.

ALTER TABLE public.ai_credit_balances
  ADD COLUMN IF NOT EXISTS credits_purchased integer NOT NULL DEFAULT 0;

ALTER TABLE public.ai_credit_balances
  DROP CONSTRAINT IF EXISTS ai_credit_balances_credits_purchased_nonneg;

ALTER TABLE public.ai_credit_balances
  ADD CONSTRAINT ai_credit_balances_credits_purchased_nonneg
  CHECK (credits_purchased >= 0);

COMMENT ON COLUMN public.ai_credit_balances.credits_purchased IS
  'One-time purchased credits that survive monthly plan pool resets.';

CREATE TABLE IF NOT EXISTS public.ai_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  stripe_checkout_session_id text NOT NULL,
  stripe_price_id text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  amount_total integer,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_credit_purchases_session_unique UNIQUE (stripe_checkout_session_id)
);

CREATE INDEX IF NOT EXISTS ix_ai_credit_purchases_account_created
  ON public.ai_credit_purchases (account_id, created_at DESC);

COMMENT ON TABLE public.ai_credit_purchases IS
  'Idempotent ledger of Stripe one-time AI credit pack purchases.';

ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_credit_purchases_select ON public.ai_credit_purchases;
CREATE POLICY ai_credit_purchases_select ON public.ai_credit_purchases
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

REVOKE ALL ON public.ai_credit_purchases FROM authenticated, service_role;
GRANT SELECT ON public.ai_credit_purchases TO authenticated;
GRANT ALL ON public.ai_credit_purchases TO service_role;

-- Monthly reset only refreshes the plan pool; purchased credits are unchanged.
CREATE OR REPLACE FUNCTION public.reset_ai_credits_if_expired(p_account_id uuid)
RETURNS public.ai_credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.ai_credit_balances;
BEGIN
  SELECT *
  INTO v_row
  FROM public.ai_credit_balances
  WHERE account_id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOW() > v_row.period_end THEN
    UPDATE public.ai_credit_balances
    SET
      credits_remaining = credits_monthly_limit,
      period_start = period_start + INTERVAL '1 month',
      period_end = period_end + INTERVAL '1 month',
      updated_at = NOW()
    WHERE account_id = p_account_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_ai_credits_if_expired(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_ai_credits_if_expired(uuid) TO service_role;

-- Atomically grant purchased credits (idempotent on Stripe checkout session id).
CREATE OR REPLACE FUNCTION public.grant_ai_credit_purchase(
  p_account_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_price_id text,
  p_credits integer,
  p_amount_total integer DEFAULT NULL,
  p_currency text DEFAULT NULL
)
RETURNS public.ai_credit_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.ai_credit_balances;
  v_inserted boolean := false;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'credits must be positive';
  END IF;

  INSERT INTO public.ai_credit_purchases (
    account_id,
    stripe_checkout_session_id,
    stripe_price_id,
    credits,
    amount_total,
    currency
  )
  VALUES (
    p_account_id,
    p_stripe_checkout_session_id,
    p_stripe_price_id,
    p_credits,
    p_amount_total,
    p_currency
  )
  ON CONFLICT (stripe_checkout_session_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF v_inserted IS NOT TRUE THEN
    SELECT *
    INTO v_row
    FROM public.ai_credit_balances
    WHERE account_id = p_account_id;

    RETURN v_row;
  END IF;

  -- Only create a balance row if missing; never overwrite an existing monthly pool.
  INSERT INTO public.ai_credit_balances (
    account_id,
    credits_remaining,
    credits_monthly_limit,
    credits_purchased
  )
  VALUES (
    p_account_id,
    200,
    200,
    p_credits
  )
  ON CONFLICT (account_id) DO UPDATE
  SET
    credits_purchased = public.ai_credit_balances.credits_purchased + EXCLUDED.credits_purchased,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_credit_purchase(uuid, text, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_ai_credit_purchase(uuid, text, text, integer, integer, text) TO service_role;
