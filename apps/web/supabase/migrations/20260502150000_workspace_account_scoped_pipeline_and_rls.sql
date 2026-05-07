-- Workspace wiring: account-scoped pipeline, optional project/business links, and clients RLS
-- aligned with app service fallbacks (owner/admin/staff membership).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) businesses.account_id — link legacy business rows to MakerKit workspaces
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS ix_businesses_account_id ON public.businesses(account_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) projects.business_id — optional link used by pipeline + colour in UI
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS ix_projects_business_id ON public.projects(business_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) pipeline_deals — ensure table exists with account_id; backfill from businesses
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pipeline_deals'
  ) THEN
    CREATE TABLE public.pipeline_deals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
      business_id uuid,
      name text,
      contact_name text,
      company_name text,
      value numeric,
      stage text NOT NULL DEFAULT 'lead',
      next_action text,
      next_action_date date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_pipeline_deals_account_id ON public.pipeline_deals(account_id);
    CREATE INDEX IF NOT EXISTS ix_pipeline_deals_business_id ON public.pipeline_deals(business_id);
    CREATE INDEX IF NOT EXISTS ix_pipeline_deals_stage ON public.pipeline_deals(stage);
    COMMENT ON TABLE public.pipeline_deals IS 'CRM pipeline deals; scoped by account_id (workspace). business_id is optional legacy segmentation.';
  ELSE
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS business_id uuid;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS name text;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS contact_name text;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS company_name text;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS value numeric;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS stage text;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS next_action text;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS next_action_date date;
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    CREATE INDEX IF NOT EXISTS ix_pipeline_deals_account_id ON public.pipeline_deals(account_id);
    CREATE INDEX IF NOT EXISTS ix_pipeline_deals_business_id ON public.pipeline_deals(business_id);
  END IF;
END $$;

-- Backfill account_id from businesses when pipeline rows only had business_id
UPDATE public.pipeline_deals pd
SET account_id = b.account_id
FROM public.businesses b
WHERE pd.business_id = b.id
  AND b.account_id IS NOT NULL
  AND pd.account_id IS NULL;

ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipeline_deals_select ON public.pipeline_deals;
CREATE POLICY pipeline_deals_select ON public.pipeline_deals
FOR SELECT TO authenticated
USING (
  (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  OR (
    account_id IS NULL
    AND business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = pipeline_deals.business_id
        AND b.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS pipeline_deals_insert ON public.pipeline_deals;
CREATE POLICY pipeline_deals_insert ON public.pipeline_deals
FOR INSERT TO authenticated
WITH CHECK (
  (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships m
      WHERE m.account_id = pipeline_deals.account_id
        AND m.user_id = auth.uid()
        AND m.account_role IN ('owner', 'admin', 'staff')
    )
  )
  OR (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = pipeline_deals.business_id
        AND b.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS pipeline_deals_update ON public.pipeline_deals;
CREATE POLICY pipeline_deals_update ON public.pipeline_deals
FOR UPDATE TO authenticated
USING (
  (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships m
      WHERE m.account_id = pipeline_deals.account_id
        AND m.user_id = auth.uid()
        AND m.account_role IN ('owner', 'admin', 'staff')
    )
  )
  OR (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = pipeline_deals.business_id
        AND b.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS pipeline_deals_delete ON public.pipeline_deals;
CREATE POLICY pipeline_deals_delete ON public.pipeline_deals
FOR DELETE TO authenticated
USING (
  (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships m
      WHERE m.account_id = pipeline_deals.account_id
        AND m.user_id = auth.uid()
        AND m.account_role IN ('owner', 'admin', 'staff')
    )
  )
  OR (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = pipeline_deals.business_id
        AND b.owner_id = auth.uid()
    )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_deals TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) clients INSERT/UPDATE/DELETE — align RLS with membership roles when
--    has_permission RPC drifts (still requires owner/admin/staff for writes).
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = clients.account_id
      AND m.user_id = auth.uid()
      AND m.account_role IN ('owner', 'admin', 'staff')
  )
);

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = clients.account_id
      AND m.user_id = auth.uid()
      AND m.account_role IN ('owner', 'admin', 'staff')
  )
);

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = clients.account_id
      AND m.user_id = auth.uid()
      AND m.account_role IN ('owner', 'admin', 'staff')
  )
);

NOTIFY pgrst, 'reload schema';
