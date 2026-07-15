-- Public mock-email preview links for Signatures templates (token-gated).

CREATE TABLE IF NOT EXISTS signatures.preview_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES signatures.templates (id) ON DELETE CASCADE,
  staff_id uuid NULL REFERENCES signatures.staff (id) ON DELETE SET NULL,
  token text NOT NULL,
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_shares_token_nonempty CHECK (length(trim(token)) >= 16)
);

COMMENT ON TABLE signatures.preview_shares IS
  'Public read-only preview links for signature templates (mock email page).';

CREATE UNIQUE INDEX IF NOT EXISTS ix_preview_shares_token
  ON signatures.preview_shares (token);

CREATE INDEX IF NOT EXISTS ix_preview_shares_account_template
  ON signatures.preview_shares (account_id, template_id)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS signatures_preview_shares_set_timestamps
  ON signatures.preview_shares;
CREATE TRIGGER signatures_preview_shares_set_timestamps
  BEFORE UPDATE ON signatures.preview_shares
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE signatures.preview_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signatures_preview_shares_select ON signatures.preview_shares;
CREATE POLICY signatures_preview_shares_select ON signatures.preview_shares
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS signatures_preview_shares_insert ON signatures.preview_shares;
CREATE POLICY signatures_preview_shares_insert ON signatures.preview_shares
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_preview_shares_update ON signatures.preview_shares;
CREATE POLICY signatures_preview_shares_update ON signatures.preview_shares
  FOR UPDATE TO authenticated
  USING (public.is_account_admin(account_id))
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_preview_shares_delete ON signatures.preview_shares;
CREATE POLICY signatures_preview_shares_delete ON signatures.preview_shares
  FOR DELETE TO authenticated
  USING (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_preview_shares_service_role ON signatures.preview_shares;
CREATE POLICY signatures_preview_shares_service_role ON signatures.preview_shares
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON signatures.preview_shares TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON signatures.preview_shares TO authenticated;

NOTIFY pgrst, 'reload schema';
