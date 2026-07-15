-- Staff signature change requests from public personal install links.

CREATE TABLE IF NOT EXISTS signatures.change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES signatures.staff (id) ON DELETE CASCADE,
  preview_share_id uuid NULL REFERENCES signatures.preview_shares (id) ON DELETE SET NULL,
  requester_name text NULL,
  requester_email text NULL,
  message text NOT NULL,
  field_keys text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz NULL,
  resolved_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT change_requests_message_nonempty CHECK (length(trim(message)) >= 3)
);

COMMENT ON TABLE signatures.change_requests IS
  'Change requests submitted from public signature install/preview pages.';

CREATE INDEX IF NOT EXISTS ix_change_requests_account_status_created
  ON signatures.change_requests (account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_change_requests_staff_open
  ON signatures.change_requests (staff_id)
  WHERE status = 'open';

DROP TRIGGER IF EXISTS signatures_change_requests_set_timestamps
  ON signatures.change_requests;
CREATE TRIGGER signatures_change_requests_set_timestamps
  BEFORE UPDATE ON signatures.change_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE signatures.change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signatures_change_requests_select ON signatures.change_requests;
CREATE POLICY signatures_change_requests_select ON signatures.change_requests
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS signatures_change_requests_update ON signatures.change_requests;
CREATE POLICY signatures_change_requests_update ON signatures.change_requests
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS signatures_change_requests_delete ON signatures.change_requests;
CREATE POLICY signatures_change_requests_delete ON signatures.change_requests
  FOR DELETE TO authenticated
  USING (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_change_requests_service_role ON signatures.change_requests;
CREATE POLICY signatures_change_requests_service_role ON signatures.change_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON signatures.change_requests TO postgres, service_role;
GRANT SELECT, UPDATE, DELETE ON signatures.change_requests TO authenticated;

NOTIFY pgrst, 'reload schema';
