-- Disposal Management: acting agents, PA, record owner, workspace team labels.

-- ---------------------------------------------------------------------------
-- 1. Simple per-workspace team labels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_workspace_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_workspace_teams_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_workspace_teams_account_name_uidx
  ON public.commercial_workspace_teams (account_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS commercial_workspace_teams_account_id_idx
  ON public.commercial_workspace_teams (account_id);

COMMENT ON TABLE public.commercial_workspace_teams IS
  'Simple team/office labels for commercial disposals (e.g. Kent).';

-- ---------------------------------------------------------------------------
-- 2. Acting agents junction (ordered)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_listing_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS commercial_listing_agents_listing_id_idx
  ON public.commercial_listing_agents (listing_id);

CREATE INDEX IF NOT EXISTS commercial_listing_agents_account_id_idx
  ON public.commercial_listing_agents (account_id);

COMMENT ON TABLE public.commercial_listing_agents IS
  'Ordered acting agents assigned to a commercial disposal.';

-- ---------------------------------------------------------------------------
-- 3. Listing assignment columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS pa_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS record_owner_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.commercial_workspace_teams (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.commercial_listings.pa_user_id IS
  'Personal assistant / PA for the disposal.';
COMMENT ON COLUMN public.commercial_listings.record_owner_user_id IS
  'Record owner for the disposal (also kept in sync with assigned_to).';
COMMENT ON COLUMN public.commercial_listings.team_id IS
  'Workspace team label assigned to the disposal.';

-- Backfill record owner from legacy assigned_to
UPDATE public.commercial_listings
SET record_owner_user_id = assigned_to
WHERE record_owner_user_id IS NULL
  AND assigned_to IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_workspace_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_listing_agents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_workspace_teams FROM authenticated, service_role;
REVOKE ALL ON public.commercial_listing_agents FROM authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_workspace_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_agents TO authenticated;

GRANT ALL ON public.commercial_workspace_teams TO service_role;
GRANT ALL ON public.commercial_listing_agents TO service_role;

DROP POLICY IF EXISTS commercial_workspace_teams_select ON public.commercial_workspace_teams;
CREATE POLICY commercial_workspace_teams_select ON public.commercial_workspace_teams
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_workspace_teams_insert ON public.commercial_workspace_teams;
CREATE POLICY commercial_workspace_teams_insert ON public.commercial_workspace_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS commercial_workspace_teams_update ON public.commercial_workspace_teams;
CREATE POLICY commercial_workspace_teams_update ON public.commercial_workspace_teams
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_workspace_teams_delete ON public.commercial_workspace_teams;
CREATE POLICY commercial_workspace_teams_delete ON public.commercial_workspace_teams
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
    OR public.has_role_on_account(account_id, 'staff')
  );

DROP POLICY IF EXISTS commercial_listing_agents_select ON public.commercial_listing_agents;
CREATE POLICY commercial_listing_agents_select ON public.commercial_listing_agents
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_agents_insert ON public.commercial_listing_agents;
CREATE POLICY commercial_listing_agents_insert ON public.commercial_listing_agents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS commercial_listing_agents_update ON public.commercial_listing_agents;
CREATE POLICY commercial_listing_agents_update ON public.commercial_listing_agents
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_agents_delete ON public.commercial_listing_agents;
CREATE POLICY commercial_listing_agents_delete ON public.commercial_listing_agents
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );
