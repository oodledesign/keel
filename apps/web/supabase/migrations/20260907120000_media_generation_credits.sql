-- Media generation add-on: credit pools, FIFO batches, ledger, jobs.
-- Enable/disable uses account_module_settings.module_key = 'media_generate'
-- (no workspace_app_installs table). Ledger mutations are service_role only.

-- ---------------------------------------------------------------------------
-- media_credit_pools (cached spendable balance; never write from app code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_credit_pools (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  monthly_allowance integer NOT NULL DEFAULT 0,
  plan_tier text NOT NULL DEFAULT 'none',
  cycle_start date,
  cycle_end date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_credit_pools_balance_nonneg CHECK (balance >= 0),
  CONSTRAINT media_credit_pools_allowance_nonneg CHECK (monthly_allowance >= 0)
);

COMMENT ON TABLE public.media_credit_pools IS
  'Cached sum of non-expired media_credit_batches.units_remaining. Maintained by ledger RPCs only.';
COMMENT ON COLUMN public.media_credit_pools.balance IS
  'Cached spendable units. Never write directly — use grant/debit/refund/expire RPCs.';
COMMENT ON COLUMN public.media_credit_pools.plan_tier IS
  'none | starter | studio | agency';

DROP TRIGGER IF EXISTS media_credit_pools_set_timestamps ON public.media_credit_pools;
CREATE TRIGGER media_credit_pools_set_timestamps
BEFORE INSERT OR UPDATE ON public.media_credit_pools
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- media_generation_jobs (created before deferred FK from transactions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  prompt text,
  refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  media_credits_charged integer,
  provider_cost_usd numeric(10, 4),
  file_url text,
  thumbnail_url text,
  external_job_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT media_generation_jobs_type_check CHECK (type IN ('image', 'video')),
  CONSTRAINT media_generation_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'complete', 'failed')
  )
);

COMMENT ON TABLE public.media_generation_jobs IS
  'Image/video generation jobs billed against media credit batches.';

CREATE INDEX IF NOT EXISTS ix_media_generation_jobs_account_created
  ON public.media_generation_jobs (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_media_generation_jobs_project_id
  ON public.media_generation_jobs (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_media_generation_jobs_client_id
  ON public.media_generation_jobs (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_media_generation_jobs_active_status
  ON public.media_generation_jobs (status)
  WHERE status IN ('queued', 'processing');

-- ---------------------------------------------------------------------------
-- media_credit_batches (FIFO by expires_at)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_credit_batches (
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
  CONSTRAINT media_credit_batches_source_type_check CHECK (
    source_type IN ('monthly_grant', 'topup_purchase')
  ),
  CONSTRAINT media_credit_batches_units_granted_pos CHECK (units_granted > 0),
  CONSTRAINT media_credit_batches_units_remaining_nonneg CHECK (units_remaining >= 0)
);

COMMENT ON TABLE public.media_credit_batches IS
  'Grant batches. Monthly grants expire at cycle_end; top-ups expire 6 months from grant.';
COMMENT ON COLUMN public.media_credit_batches.stripe_event_id IS
  'Stripe event/session idempotency key. Null for non-Stripe grants.';
COMMENT ON COLUMN public.media_credit_batches.swept_at IS
  'Set by expire sweep so re-runs are no-ops.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_media_credit_batches_stripe_event_id
  ON public.media_credit_batches (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_media_credit_batches_spendable
  ON public.media_credit_batches (account_id, expires_at)
  WHERE units_remaining > 0 AND swept_at IS NULL;

-- ---------------------------------------------------------------------------
-- media_credit_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.media_credit_batches (id) ON DELETE SET NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  related_job_id uuid,
  stripe_event_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_credit_transactions_type_check CHECK (
    type IN (
      'monthly_grant',
      'topup_purchase',
      'generation_debit',
      'refund',
      'expiry',
      'admin_adjust'
    )
  )
);

COMMENT ON TABLE public.media_credit_transactions IS
  'Immutable media credit ledger. Debits may span multiple rows (one per batch).';

CREATE INDEX IF NOT EXISTS ix_media_credit_transactions_account_created
  ON public.media_credit_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_media_credit_transactions_related_job
  ON public.media_credit_transactions (related_job_id)
  WHERE related_job_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_media_credit_transactions_related_job'
  ) THEN
    ALTER TABLE public.media_credit_transactions
      ADD CONSTRAINT fk_media_credit_transactions_related_job
      FOREIGN KEY (related_job_id)
      REFERENCES public.media_generation_jobs (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS (read for members; writes service_role only — match ai_credit_* pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE public.media_credit_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_credit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_credit_pools_select ON public.media_credit_pools;
CREATE POLICY media_credit_pools_select ON public.media_credit_pools
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS media_credit_batches_select ON public.media_credit_batches;
CREATE POLICY media_credit_batches_select ON public.media_credit_batches
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS media_credit_transactions_select ON public.media_credit_transactions;
CREATE POLICY media_credit_transactions_select ON public.media_credit_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS media_generation_jobs_select ON public.media_generation_jobs;
CREATE POLICY media_generation_jobs_select ON public.media_generation_jobs
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

REVOKE ALL ON public.media_credit_pools FROM authenticated, service_role;
REVOKE ALL ON public.media_credit_batches FROM authenticated, service_role;
REVOKE ALL ON public.media_credit_transactions FROM authenticated, service_role;
REVOKE ALL ON public.media_generation_jobs FROM authenticated, service_role;

GRANT SELECT ON public.media_credit_pools TO authenticated;
GRANT SELECT ON public.media_credit_batches TO authenticated;
GRANT SELECT ON public.media_credit_transactions TO authenticated;
GRANT SELECT ON public.media_generation_jobs TO authenticated;

GRANT ALL ON public.media_credit_pools TO service_role;
GRANT ALL ON public.media_credit_batches TO service_role;
GRANT ALL ON public.media_credit_transactions TO service_role;
GRANT ALL ON public.media_generation_jobs TO service_role;
