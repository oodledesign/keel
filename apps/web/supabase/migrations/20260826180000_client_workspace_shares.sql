-- Multi-workspace client shares with per-module capabilities.
-- Replaces client_orgs.linked_account_id (single partner link).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.client_workspace_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.client_orgs (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  guest_account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  invite_token text NOT NULL,
  invited_email text,
  can_support boolean NOT NULL DEFAULT false,
  can_contacts boolean NOT NULL DEFAULT false,
  can_projects boolean NOT NULL DEFAULT false,
  can_docs boolean NOT NULL DEFAULT false,
  can_finance boolean NOT NULL DEFAULT false,
  can_portal boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_workspace_shares_invite_token_unique UNIQUE (invite_token)
);

COMMENT ON TABLE public.client_workspace_shares IS
  'Grants another Ozer workspace scoped access to a provider client_org.';

CREATE INDEX IF NOT EXISTS ix_client_workspace_shares_owner
  ON public.client_workspace_shares (owner_account_id);

CREATE INDEX IF NOT EXISTS ix_client_workspace_shares_guest_active
  ON public.client_workspace_shares (guest_account_id)
  WHERE status = 'active' AND guest_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_client_workspace_shares_org
  ON public.client_workspace_shares (client_org_id);

CREATE UNIQUE INDEX IF NOT EXISTS ix_client_workspace_shares_active_guest
  ON public.client_workspace_shares (client_org_id, guest_account_id)
  WHERE status = 'active' AND guest_account_id IS NOT NULL;

-- Backfill from legacy single partner link.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_orgs'
      AND column_name = 'linked_account_id'
  ) THEN
    INSERT INTO public.client_workspace_shares (
      owner_account_id,
      client_org_id,
      guest_account_id,
      status,
      invite_token,
      can_support,
      accepted_at
    )
    SELECT
      COALESCE(
        (
          SELECT b.account_id
          FROM public.businesses b
          WHERE b.id = o.business_id
          LIMIT 1
        ),
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.accounts a WHERE a.id = o.business_id
          ) THEN o.business_id
          ELSE NULL
        END
      ),
      o.id,
      o.linked_account_id,
      'active',
      encode(extensions.gen_random_bytes(24), 'hex'),
      true,
      now()
    FROM public.client_orgs o
    WHERE o.linked_account_id IS NOT NULL
      AND o.business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts a WHERE a.id = o.linked_account_id
      )
      AND COALESCE(
        (
          SELECT b.account_id
          FROM public.businesses b
          WHERE b.id = o.business_id
          LIMIT 1
        ),
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.accounts a WHERE a.id = o.business_id
          ) THEN o.business_id
          ELSE NULL
        END
      ) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.client_workspace_shares s
        WHERE s.client_org_id = o.id
          AND s.guest_account_id = o.linked_account_id
          AND s.status = 'active'
      );

    DROP INDEX IF EXISTS public.ix_client_orgs_linked_account_id;
    ALTER TABLE public.client_orgs DROP COLUMN IF EXISTS linked_account_id;
  END IF;
END $$;

ALTER TABLE public.client_workspace_shares ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.client_workspace_shares FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_workspace_shares TO authenticated;
GRANT ALL ON public.client_workspace_shares TO service_role;

DROP POLICY IF EXISTS client_workspace_shares_select ON public.client_workspace_shares;
CREATE POLICY client_workspace_shares_select
  ON public.client_workspace_shares
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_on_account(owner_account_id)
    OR (
      status = 'active'
      AND guest_account_id IS NOT NULL
      AND public.has_role_on_account(guest_account_id)
    )
  );

DROP POLICY IF EXISTS client_workspace_shares_insert ON public.client_workspace_shares;
CREATE POLICY client_workspace_shares_insert
  ON public.client_workspace_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(
      auth.uid(),
      owner_account_id,
      'clients.edit'::public.app_permissions
    )
    OR public.has_role_on_account(owner_account_id)
  );

DROP POLICY IF EXISTS client_workspace_shares_update ON public.client_workspace_shares;
CREATE POLICY client_workspace_shares_update
  ON public.client_workspace_shares
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission(
      auth.uid(),
      owner_account_id,
      'clients.edit'::public.app_permissions
    )
    OR public.has_role_on_account(owner_account_id)
  )
  WITH CHECK (
    public.has_permission(
      auth.uid(),
      owner_account_id,
      'clients.edit'::public.app_permissions
    )
    OR public.has_role_on_account(owner_account_id)
  );

DROP POLICY IF EXISTS client_workspace_shares_delete ON public.client_workspace_shares;
CREATE POLICY client_workspace_shares_delete
  ON public.client_workspace_shares
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission(
      auth.uid(),
      owner_account_id,
      'clients.edit'::public.app_permissions
    )
    OR public.has_role_on_account(owner_account_id)
  );

NOTIFY pgrst, 'reload schema';
