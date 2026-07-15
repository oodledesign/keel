-- Prompt G2: plan templates + recurring client subscriptions on Stripe Connect.
-- Additive / IF NOT EXISTS only. Workspace-scoped via account_id where possible.

-- ---------------------------------------------------------------------------
-- 1) plan_templates (workspace recurring offerings)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('hosting', 'retainer', 'care_plan', 'custom')),
  name text NOT NULL,
  description text,
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'gbp',
  billing_interval text NOT NULL DEFAULT 'month'
    CHECK (billing_interval IN ('month', 'year')),
  stripe_product_id text,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Legacy remote shape may have business_id / monthly_amount / is_active without G2 cols.
-- ADD COLUMN must come before COMMENT ON COLUMN (table may already exist).
ALTER TABLE public.plan_templates
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS amount integer,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS active boolean,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

COMMENT ON TABLE public.plan_templates IS
  'G2: Workspace recurring offerings (hosting, retainers, care plans). stripe_price_id is on the connected account.';
COMMENT ON COLUMN public.plan_templates.amount IS
  'Minor units (pence). Stripe Price unit_amount.';
COMMENT ON COLUMN public.plan_templates.billing_interval IS
  'month | year (Stripe recurring.interval).';

-- Backfill from legacy columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_templates'
      AND column_name = 'monthly_amount'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_templates'
      AND column_name = 'amount'
  ) THEN
    EXECUTE 'UPDATE public.plan_templates SET amount = COALESCE(amount, monthly_amount, 0) WHERE amount IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_templates'
      AND column_name = 'is_active'
  ) THEN
    EXECUTE 'UPDATE public.plan_templates SET active = COALESCE(active, is_active, true) WHERE active IS NULL';
  END IF;

  -- Never assign business_id as account_id unless it exists in accounts
  -- (legacy seeds used a1000000-… business ids that are not accounts).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_templates'
      AND column_name = 'business_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    EXECUTE $u$
      UPDATE public.plan_templates pt
      SET account_id = b.account_id
      FROM public.businesses b
      WHERE pt.account_id IS NULL
        AND b.id = pt.business_id
        AND EXISTS (
          SELECT 1 FROM public.accounts a WHERE a.id = b.account_id
        )
    $u$;

    EXECUTE $u$
      UPDATE public.plan_templates pt
      SET account_id = pt.business_id
      WHERE pt.account_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.accounts a WHERE a.id = pt.business_id
        )
    $u$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_templates'
      AND column_name = 'business_id'
  ) THEN
    EXECUTE $u$
      UPDATE public.plan_templates pt
      SET account_id = pt.business_id
      WHERE pt.account_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.accounts a WHERE a.id = pt.business_id
        )
    $u$;
  END IF;
END $$;

UPDATE public.plan_templates
SET
  kind = COALESCE(kind, 'custom'),
  amount = COALESCE(amount, 0),
  currency = COALESCE(currency, 'gbp'),
  billing_interval = COALESCE(billing_interval, 'month'),
  active = COALESCE(active, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE kind IS NULL
   OR amount IS NULL
   OR currency IS NULL
   OR billing_interval IS NULL
   OR active IS NULL;

-- Drop rows that still cannot resolve an account (should be none after backfill)
DELETE FROM public.plan_templates WHERE account_id IS NULL;

ALTER TABLE public.plan_templates
  ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_plan_templates_account_id
  ON public.plan_templates (account_id);

CREATE INDEX IF NOT EXISTS ix_plan_templates_account_active
  ON public.plan_templates (account_id, active)
  WHERE active = true;

DROP TRIGGER IF EXISTS plan_templates_set_timestamps ON public.plan_templates;
CREATE TRIGGER plan_templates_set_timestamps
  BEFORE INSERT OR UPDATE ON public.plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_templates_select ON public.plan_templates;
CREATE POLICY plan_templates_select ON public.plan_templates
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS plan_templates_insert ON public.plan_templates;
CREATE POLICY plan_templates_insert ON public.plan_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS plan_templates_update ON public.plan_templates;
CREATE POLICY plan_templates_update ON public.plan_templates
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account (account_id))
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS plan_templates_delete ON public.plan_templates;
CREATE POLICY plan_templates_delete ON public.plan_templates
  FOR DELETE TO authenticated
  USING (public.has_role_on_account (account_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_templates TO authenticated;
GRANT ALL ON public.plan_templates TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Extend client_subscriptions for G2
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS website_id uuid REFERENCES public.websites (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_template_id uuid REFERENCES public.plan_templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_kind text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Allow inserts keyed only by account_id (websites already treat business_id ≈ accounts.id)
ALTER TABLE public.client_subscriptions
  ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE public.client_subscriptions
  ALTER COLUMN client_org_id DROP NOT NULL;

-- Prefer account-scoped RLS; only set account_id when the target exists
DO $$
BEGIN
  UPDATE public.client_subscriptions cs
  SET account_id = b.account_id
  FROM public.businesses b
  WHERE cs.account_id IS NULL
    AND b.id = cs.business_id
    AND EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.id = b.account_id
    );

  UPDATE public.client_subscriptions cs
  SET account_id = cs.business_id
  WHERE cs.account_id IS NULL
    AND cs.business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.id = cs.business_id
    );
EXCEPTION
  WHEN undefined_table THEN
    UPDATE public.client_subscriptions cs
    SET account_id = cs.business_id
    WHERE cs.account_id IS NULL
      AND cs.business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts a WHERE a.id = cs.business_id
      );
END $$;

COMMENT ON COLUMN public.client_subscriptions.current_period_end IS
  'Stripe subscription current_period_end; synced after Checkout activates.';
COMMENT ON COLUMN public.client_subscriptions.subscription_kind IS
  'hosting | retainer | care_plan | custom (denormalised from plan_templates.kind).';

-- Status: allow incomplete (Checkout pending)
ALTER TABLE public.client_subscriptions
  DROP CONSTRAINT IF EXISTS client_subscriptions_status_check;
ALTER TABLE public.client_subscriptions
  ADD CONSTRAINT client_subscriptions_status_check
  CHECK (status IN ('pending', 'incomplete', 'active', 'overdue', 'cancelled'));

CREATE INDEX IF NOT EXISTS ix_client_subscriptions_account_id
  ON public.client_subscriptions (account_id);
CREATE INDEX IF NOT EXISTS ix_client_subscriptions_client_id
  ON public.client_subscriptions (client_id);
CREATE INDEX IF NOT EXISTS ix_client_subscriptions_website_id
  ON public.client_subscriptions (website_id);
CREATE INDEX IF NOT EXISTS ix_client_subscriptions_plan_template_id
  ON public.client_subscriptions (plan_template_id);

-- Widen workspace RLS to account_id (preserve legacy business path)
DROP POLICY IF EXISTS client_subscriptions_workspace ON public.client_subscriptions;
CREATE POLICY client_subscriptions_workspace ON public.client_subscriptions
  FOR ALL TO authenticated
  USING (
    (
      account_id IS NOT NULL
      AND public.has_role_on_account (account_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = business_id
        AND public.has_role_on_account (b.account_id)
    )
    OR public.is_super_admin ()
  )
  WITH CHECK (
    (
      account_id IS NOT NULL
      AND public.has_role_on_account (account_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = business_id
        AND public.has_role_on_account (b.account_id)
    )
    OR public.is_super_admin ()
  );

-- ---------------------------------------------------------------------------
-- 3) subscription_line_items — price snapshot at subscribe time
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_subscription_id uuid NOT NULL
    REFERENCES public.client_subscriptions (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  plan_template_id uuid REFERENCES public.plan_templates (id) ON DELETE SET NULL,
  kind text,
  description text NOT NULL DEFAULT '',
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  billing_interval text NOT NULL DEFAULT 'month'
    CHECK (billing_interval IN ('month', 'year')),
  stripe_price_id text,
  item_type text NOT NULL DEFAULT 'recurring_price',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_line_items
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_template_id uuid REFERENCES public.plan_templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS amount integer,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

COMMENT ON TABLE public.subscription_line_items IS
  'G2: Snapshot of recurring line(s) attached to a client_subscriptions row at create/checkout time.';

CREATE INDEX IF NOT EXISTS ix_subscription_line_items_subscription_id
  ON public.subscription_line_items (client_subscription_id);
CREATE INDEX IF NOT EXISTS ix_subscription_line_items_account_id
  ON public.subscription_line_items (account_id);

ALTER TABLE public.subscription_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_line_items_workspace ON public.subscription_line_items;
CREATE POLICY subscription_line_items_workspace ON public.subscription_line_items
  FOR ALL TO authenticated
  USING (public.has_role_on_account (account_id) OR public.is_super_admin ())
  WITH CHECK (public.has_role_on_account (account_id) OR public.is_super_admin ());

DROP POLICY IF EXISTS subscription_line_items_client_portal_read ON public.subscription_line_items;
CREATE POLICY subscription_line_items_client_portal_read ON public.subscription_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_subscriptions cs
      WHERE cs.id = subscription_line_items.client_subscription_id
        AND (
          (
            cs.client_org_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.client_members cm
              WHERE cm.client_org_id = cs.client_org_id
                AND cm.user_id = (SELECT auth.uid ())
            )
          )
          OR (
            cs.client_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.clients c
              JOIN public.client_members cm
                ON cm.client_org_id = c.client_org_id
              WHERE c.id = cs.client_id
                AND cm.user_id = (SELECT auth.uid ())
            )
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_line_items TO authenticated;
GRANT ALL ON public.subscription_line_items TO service_role;

-- ---------------------------------------------------------------------------
-- 4) clients.stripe_customer_id_connect — customer on the connected account
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id_connect text;

COMMENT ON COLUMN public.clients.stripe_customer_id_connect IS
  'Stripe Customer id on the workspace Connect account (G2 recurring billing).';

CREATE UNIQUE INDEX IF NOT EXISTS ix_clients_stripe_customer_id_connect
  ON public.clients (stripe_customer_id_connect)
  WHERE stripe_customer_id_connect IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) application_fee_percent on workspace payment settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS application_fee_percent numeric(5, 2) DEFAULT 10;

COMMENT ON COLUMN public.account_payment_settings.application_fee_percent IS
  'Platform application fee % for Connect recurring Checkout (default 10).';

UPDATE public.account_payment_settings
SET application_fee_percent = COALESCE(application_fee_percent, 10)
WHERE application_fee_percent IS NULL;
