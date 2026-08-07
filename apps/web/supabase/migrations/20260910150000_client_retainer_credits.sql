-- Client retainer credits: extend plan_templates, request_types catalogue,
-- and FIFO credit ledger (mirrors media_credit_*). Additive / IF NOT EXISTS only.
-- Ledger mutations are service_role / SECURITY DEFINER RPCs only (Prompt 2).

-- ---------------------------------------------------------------------------
-- 1) plan_templates — credit allowance + rollover
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_templates
  ADD COLUMN IF NOT EXISTS credits_per_cycle integer,
  ADD COLUMN IF NOT EXISTS rollover_policy text,
  ADD COLUMN IF NOT EXISTS rollover_cap integer;

UPDATE public.plan_templates
SET rollover_policy = COALESCE(rollover_policy, 'expire')
WHERE rollover_policy IS NULL;

ALTER TABLE public.plan_templates
  ALTER COLUMN rollover_policy SET DEFAULT 'expire';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plan_templates_rollover_policy_check'
  ) THEN
    ALTER TABLE public.plan_templates
      ADD CONSTRAINT plan_templates_rollover_policy_check
      CHECK (rollover_policy IS NULL OR rollover_policy IN ('expire', 'rollover', 'cap'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plan_templates_credits_per_cycle_nonneg'
  ) THEN
    ALTER TABLE public.plan_templates
      ADD CONSTRAINT plan_templates_credits_per_cycle_nonneg
      CHECK (credits_per_cycle IS NULL OR credits_per_cycle >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plan_templates_rollover_cap_nonneg'
  ) THEN
    ALTER TABLE public.plan_templates
      ADD CONSTRAINT plan_templates_rollover_cap_nonneg
      CHECK (rollover_cap IS NULL OR rollover_cap >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.plan_templates.credits_per_cycle IS
  'Credits granted to the client when a retainer invoice for this plan is paid.';
COMMENT ON COLUMN public.plan_templates.rollover_policy IS
  'expire | rollover | cap — how unused credits behave at cycle end.';
COMMENT ON COLUMN public.plan_templates.rollover_cap IS
  'Max banked balance when rollover_policy = cap. Ignored otherwise.';
COMMENT ON COLUMN public.plan_templates.support_tickets_per_month IS
  'DEPRECATED for workspace client retainers — use credits_per_cycle + request_types. Kept for legacy/display; platform support tickets are separate.';
COMMENT ON COLUMN public.plan_templates.update_hours_per_month IS
  'DEPRECATED for workspace client retainers — use credits_per_cycle. Kept for legacy/display.';

-- ---------------------------------------------------------------------------
-- 2) request_types — workspace-defined ticket / request categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses (id) ON DELETE SET NULL,
  label text NOT NULL,
  credit_cost integer NOT NULL DEFAULT 0,
  is_billable boolean NOT NULL DEFAULT true,
  category_group text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_types_credit_cost_nonneg CHECK (credit_cost >= 0)
);

COMMENT ON TABLE public.request_types IS
  'Workspace-defined request/ticket categories with optional credit cost. Billing is a property of the category.';
COMMENT ON COLUMN public.request_types.category_group IS
  'Business-defined grouping, e.g. support | retainer_work.';
COMMENT ON COLUMN public.request_types.is_billable IS
  'When false, tickets skip credit snapshot/deduction and behave as free support.';

CREATE INDEX IF NOT EXISTS ix_request_types_account_active
  ON public.request_types (account_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS ix_request_types_business_id
  ON public.request_types (business_id)
  WHERE business_id IS NOT NULL;

DROP TRIGGER IF EXISTS request_types_set_timestamps ON public.request_types;
CREATE TRIGGER request_types_set_timestamps
BEFORE INSERT OR UPDATE ON public.request_types
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_types_select ON public.request_types;
CREATE POLICY request_types_select ON public.request_types
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS request_types_insert ON public.request_types;
CREATE POLICY request_types_insert ON public.request_types
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS request_types_update ON public.request_types;
CREATE POLICY request_types_update ON public.request_types
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  )
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS request_types_delete ON public.request_types;
CREATE POLICY request_types_delete ON public.request_types
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_types TO authenticated;
GRANT ALL ON public.request_types TO service_role;

-- ---------------------------------------------------------------------------
-- 3) client_credit_pools — cached balance (RPC-maintained)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_credit_pools (
  client_org_id uuid PRIMARY KEY REFERENCES public.client_orgs (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  cycle_start date,
  cycle_end date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_credit_pools_balance_nonneg CHECK (balance >= 0)
);

COMMENT ON TABLE public.client_credit_pools IS
  'Cached sum of non-expired client_credit_batches.units_remaining. Maintained by ledger RPCs only.';
COMMENT ON COLUMN public.client_credit_pools.balance IS
  'Cached spendable units. Never write directly — use grant/consume/refund/expire RPCs.';

CREATE INDEX IF NOT EXISTS ix_client_credit_pools_account_id
  ON public.client_credit_pools (account_id);

DROP TRIGGER IF EXISTS client_credit_pools_set_timestamps ON public.client_credit_pools;
CREATE TRIGGER client_credit_pools_set_timestamps
BEFORE INSERT OR UPDATE ON public.client_credit_pools
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- 4) client_credit_batches — FIFO grant batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_credit_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id uuid NOT NULL REFERENCES public.client_orgs (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  units_granted integer NOT NULL,
  units_remaining integer NOT NULL,
  related_invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  swept_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_credit_batches_source_type_check CHECK (
    source_type IN ('retainer_grant', 'topup_purchase', 'manual_adjustment')
  ),
  CONSTRAINT client_credit_batches_units_granted_pos CHECK (units_granted > 0),
  CONSTRAINT client_credit_batches_units_remaining_nonneg CHECK (units_remaining >= 0)
);

COMMENT ON TABLE public.client_credit_batches IS
  'Grant batches. Retainer grants expire per plan_templates.rollover_policy; top-ups typically expire 6 months from grant.';
COMMENT ON COLUMN public.client_credit_batches.expires_at IS
  'Null when rollover_policy = rollover/cap (no batch expiry). FIFO spend uses NULLS LAST.';
COMMENT ON COLUMN public.client_credit_batches.swept_at IS
  'Set by expire sweep so re-runs are no-ops.';

CREATE INDEX IF NOT EXISTS ix_client_credit_batches_spendable
  ON public.client_credit_batches (client_org_id, expires_at NULLS LAST)
  WHERE units_remaining > 0 AND swept_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_client_credit_batches_account_id
  ON public.client_credit_batches (account_id);

CREATE INDEX IF NOT EXISTS ix_client_credit_batches_related_invoice
  ON public.client_credit_batches (related_invoice_id)
  WHERE related_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) client_credit_transactions — immutable ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id uuid NOT NULL REFERENCES public.client_orgs (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.client_credit_batches (id) ON DELETE SET NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  related_ticket_id uuid REFERENCES public.support_tickets (id) ON DELETE SET NULL,
  related_invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_credit_transactions_type_check CHECK (
    type IN ('grant', 'consume', 'refund', 'expire', 'manual_adjustment')
  )
);

COMMENT ON TABLE public.client_credit_transactions IS
  'Immutable client credit ledger. Consumes may span multiple rows (one per batch).';

CREATE INDEX IF NOT EXISTS ix_client_credit_transactions_org_created
  ON public.client_credit_transactions (client_org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_client_credit_transactions_account_created
  ON public.client_credit_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_client_credit_transactions_ticket
  ON public.client_credit_transactions (related_ticket_id)
  WHERE related_ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_client_credit_transactions_invoice
  ON public.client_credit_transactions (related_invoice_id)
  WHERE related_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6) support_tickets — credit snapshot + deduction marker
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_cost_snapshot integer,
  ADD COLUMN IF NOT EXISTS credits_deducted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'support_tickets_credit_cost_snapshot_nonneg'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_credit_cost_snapshot_nonneg
      CHECK (credit_cost_snapshot IS NULL OR credit_cost_snapshot >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.support_tickets.request_type_id IS
  'Optional workspace request category. Free-text type remains for legacy tickets.';
COMMENT ON COLUMN public.support_tickets.credit_cost_snapshot IS
  'Credit cost captured at submission; immune to later request_types.credit_cost changes.';
COMMENT ON COLUMN public.support_tickets.credits_deducted_at IS
  'Set when consume_client_credits succeeds on transition to in-progress.';

CREATE INDEX IF NOT EXISTS ix_support_tickets_request_type_id
  ON public.support_tickets (request_type_id)
  WHERE request_type_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS — credit tables: member SELECT; writes service_role / RPCs only
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_credit_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_credit_pools_select ON public.client_credit_pools;
CREATE POLICY client_credit_pools_select ON public.client_credit_pools
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS client_credit_batches_select ON public.client_credit_batches;
CREATE POLICY client_credit_batches_select ON public.client_credit_batches
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS client_credit_transactions_select ON public.client_credit_transactions;
CREATE POLICY client_credit_transactions_select ON public.client_credit_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

REVOKE ALL ON public.client_credit_pools FROM authenticated, service_role;
REVOKE ALL ON public.client_credit_batches FROM authenticated, service_role;
REVOKE ALL ON public.client_credit_transactions FROM authenticated, service_role;

GRANT SELECT ON public.client_credit_pools TO authenticated;
GRANT SELECT ON public.client_credit_batches TO authenticated;
GRANT SELECT ON public.client_credit_transactions TO authenticated;

GRANT ALL ON public.client_credit_pools TO service_role;
GRANT ALL ON public.client_credit_batches TO service_role;
GRANT ALL ON public.client_credit_transactions TO service_role;
