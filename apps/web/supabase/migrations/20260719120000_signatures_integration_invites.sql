-- Time-limited links for external Google / Microsoft admins to connect Signatures
-- without a Keel account.

CREATE TABLE IF NOT EXISTS signatures.integration_connect_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('microsoft', 'google')),
  token_hash text NOT NULL UNIQUE,
  label text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_email text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_signatures_integration_invites_account
  ON signatures.integration_connect_invites (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_signatures_integration_invites_active
  ON signatures.integration_connect_invites (account_id, provider)
  WHERE used_at IS NULL AND revoked_at IS NULL;

ALTER TABLE signatures.integration_connect_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signatures_integration_connect_invites_select
  ON signatures.integration_connect_invites;
CREATE POLICY signatures_integration_connect_invites_select
  ON signatures.integration_connect_invites
  FOR SELECT TO authenticated
  USING (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_integration_connect_invites_insert
  ON signatures.integration_connect_invites;
CREATE POLICY signatures_integration_connect_invites_insert
  ON signatures.integration_connect_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_integration_connect_invites_update
  ON signatures.integration_connect_invites;
CREATE POLICY signatures_integration_connect_invites_update
  ON signatures.integration_connect_invites
  FOR UPDATE TO authenticated
  USING (public.is_account_admin(account_id))
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_integration_connect_invites_delete
  ON signatures.integration_connect_invites;
CREATE POLICY signatures_integration_connect_invites_delete
  ON signatures.integration_connect_invites
  FOR DELETE TO authenticated
  USING (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_integration_connect_invites_service_role
  ON signatures.integration_connect_invites;
CREATE POLICY signatures_integration_connect_invites_service_role
  ON signatures.integration_connect_invites
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON signatures.integration_connect_invites TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON signatures.integration_connect_invites TO authenticated;

COMMENT ON TABLE signatures.integration_connect_invites IS
  'One-time links for external IT admins to connect M365 or Google Workspace to Signatures without a Keel login.';
