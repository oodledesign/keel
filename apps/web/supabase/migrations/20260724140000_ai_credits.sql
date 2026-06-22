-- AI credit balances, usage ledger, and batch jobs for Ozer AI router.
-- Env: ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, CRON_SECRET (app layer).

CREATE TABLE IF NOT EXISTS public.ai_credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  credits_remaining integer NOT NULL DEFAULT 0,
  credits_monthly_limit integer NOT NULL DEFAULT 200,
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', NOW()),
  period_end timestamptz NOT NULL DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  feature text NOT NULL,
  provider text NOT NULL,
  model_used text NOT NULL,
  credits_used integer NOT NULL,
  input_tokens integer,
  output_tokens integer,
  was_batched boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  CONSTRAINT ai_credit_transactions_provider_check CHECK (
    provider IN ('anthropic', 'google')
  )
);

CREATE TABLE IF NOT EXISTS public.ai_batch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'anthropic',
  external_batch_id text,
  feature text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requests jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb,
  credits_reserved integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  completed_at timestamptz,
  CONSTRAINT ai_batch_jobs_provider_check CHECK (
    provider IN ('anthropic', 'google')
  ),
  CONSTRAINT ai_batch_jobs_status_check CHECK (
    status IN ('pending', 'submitted', 'processing', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS ix_ai_credit_transactions_account_created
  ON public.ai_credit_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_ai_batch_jobs_status_provider
  ON public.ai_batch_jobs (status, provider, created_at);

COMMENT ON TABLE public.ai_credit_balances IS
  'Per-account AI credit pool for Ozer AI router usage.';
COMMENT ON TABLE public.ai_credit_transactions IS
  'Immutable ledger of AI credit consumption.';
COMMENT ON TABLE public.ai_batch_jobs IS
  'Queued and in-flight AI batch requests (Anthropic or Google).';

DROP TRIGGER IF EXISTS ai_credit_balances_set_timestamps ON public.ai_credit_balances;
CREATE TRIGGER ai_credit_balances_set_timestamps
BEFORE INSERT OR UPDATE ON public.ai_credit_balances
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS ai_batch_jobs_set_timestamps ON public.ai_batch_jobs;
CREATE TRIGGER ai_batch_jobs_set_timestamps
BEFORE INSERT OR UPDATE ON public.ai_batch_jobs
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.ai_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_batch_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_credit_balances_select ON public.ai_credit_balances;
CREATE POLICY ai_credit_balances_select ON public.ai_credit_balances
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS ai_credit_transactions_select ON public.ai_credit_transactions;
CREATE POLICY ai_credit_transactions_select ON public.ai_credit_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS ai_batch_jobs_select ON public.ai_batch_jobs;
CREATE POLICY ai_batch_jobs_select ON public.ai_batch_jobs
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

REVOKE ALL ON public.ai_credit_balances FROM authenticated, service_role;
REVOKE ALL ON public.ai_credit_transactions FROM authenticated, service_role;
REVOKE ALL ON public.ai_batch_jobs FROM authenticated, service_role;

GRANT SELECT ON public.ai_credit_balances TO authenticated;
GRANT SELECT ON public.ai_credit_transactions TO authenticated;
GRANT SELECT ON public.ai_batch_jobs TO authenticated;

GRANT ALL ON public.ai_credit_balances TO service_role;
GRANT ALL ON public.ai_credit_transactions TO service_role;
GRANT ALL ON public.ai_batch_jobs TO service_role;

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
