-- Workspace-level Signatures preferences (manual / self-install mode without OAuth).

CREATE TABLE IF NOT EXISTS signatures.workspace_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  manual_mode_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE signatures.workspace_settings IS
  'Per-workspace Signatures preferences. manual_mode_enabled unlocks staff/templates without MS365/Google OAuth.';

COMMENT ON COLUMN signatures.workspace_settings.manual_mode_enabled IS
  'When true, Signatures UI is available without a mail provider; Sync/Push stay disabled until OAuth connects.';

DROP TRIGGER IF EXISTS signatures_workspace_settings_set_timestamps
  ON signatures.workspace_settings;
CREATE TRIGGER signatures_workspace_settings_set_timestamps
  BEFORE UPDATE ON signatures.workspace_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE signatures.workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signatures_workspace_settings_select
  ON signatures.workspace_settings;
CREATE POLICY signatures_workspace_settings_select
  ON signatures.workspace_settings
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS signatures_workspace_settings_insert
  ON signatures.workspace_settings;
CREATE POLICY signatures_workspace_settings_insert
  ON signatures.workspace_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_workspace_settings_update
  ON signatures.workspace_settings;
CREATE POLICY signatures_workspace_settings_update
  ON signatures.workspace_settings
  FOR UPDATE TO authenticated
  USING (public.is_account_admin(account_id))
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_workspace_settings_service_role
  ON signatures.workspace_settings;
CREATE POLICY signatures_workspace_settings_service_role
  ON signatures.workspace_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON signatures.workspace_settings FROM authenticated, service_role;
GRANT ALL ON signatures.workspace_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON signatures.workspace_settings TO authenticated;

NOTIFY pgrst, 'reload schema';
