-- Scoped signature assets: custom text + award badges
-- for workspace / department / branch (multiple per account).

CREATE TABLE IF NOT EXISTS signatures.signature_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('custom_text', 'award_badge')),
  scope text NOT NULL CHECK (scope IN ('workspace', 'department', 'branch')),
  department text NULL,
  branch_id uuid NULL REFERENCES public.account_branches (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  body text NULL,
  image_url text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_assets_scope_shape CHECK (
    (
      scope = 'workspace'
      AND department IS NULL
      AND branch_id IS NULL
    )
    OR (
      scope = 'department'
      AND department IS NOT NULL
      AND length(trim(department)) > 0
      AND branch_id IS NULL
    )
    OR (
      scope = 'branch'
      AND branch_id IS NOT NULL
      AND department IS NULL
    )
  ),
  CONSTRAINT signature_assets_payload_shape CHECK (
    (
      kind = 'custom_text'
      AND body IS NOT NULL
      AND length(trim(body)) > 0
      AND image_url IS NULL
    )
    OR (
      kind = 'award_badge'
      AND image_url IS NOT NULL
      AND length(trim(image_url)) > 0
      AND body IS NULL
    )
  )
);

COMMENT ON TABLE signatures.signature_assets IS
  'Account-managed signature snippets and award badges scoped to workspace, department, or branch.';

CREATE INDEX IF NOT EXISTS ix_signature_assets_account_kind
  ON signatures.signature_assets (account_id, kind);

CREATE INDEX IF NOT EXISTS ix_signature_assets_account_scope_dept
  ON signatures.signature_assets (account_id, scope, department)
  WHERE scope = 'department';

CREATE INDEX IF NOT EXISTS ix_signature_assets_account_scope_branch
  ON signatures.signature_assets (account_id, scope, branch_id)
  WHERE scope = 'branch';

DROP TRIGGER IF EXISTS signatures_signature_assets_set_timestamps
  ON signatures.signature_assets;
CREATE TRIGGER signatures_signature_assets_set_timestamps
  BEFORE UPDATE ON signatures.signature_assets
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE signatures.signature_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signatures_signature_assets_select ON signatures.signature_assets;
CREATE POLICY signatures_signature_assets_select ON signatures.signature_assets
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS signatures_signature_assets_insert ON signatures.signature_assets;
CREATE POLICY signatures_signature_assets_insert ON signatures.signature_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_signature_assets_update ON signatures.signature_assets;
CREATE POLICY signatures_signature_assets_update ON signatures.signature_assets
  FOR UPDATE TO authenticated
  USING (public.is_account_admin(account_id))
  WITH CHECK (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_signature_assets_delete ON signatures.signature_assets;
CREATE POLICY signatures_signature_assets_delete ON signatures.signature_assets
  FOR DELETE TO authenticated
  USING (public.is_account_admin(account_id));

DROP POLICY IF EXISTS signatures_signature_assets_service_role ON signatures.signature_assets;
CREATE POLICY signatures_signature_assets_service_role ON signatures.signature_assets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON signatures.signature_assets TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON signatures.signature_assets TO authenticated;

-- Backfill award badges from the department-only table.
INSERT INTO signatures.signature_assets (
  account_id,
  kind,
  scope,
  department,
  label,
  image_url,
  sort_order,
  created_at,
  updated_at
)
SELECT
  db.account_id,
  'award_badge',
  'department',
  db.department,
  db.department,
  db.award_badge_url,
  0,
  COALESCE(db.created_at, now()),
  COALESCE(db.updated_at, now())
FROM signatures.department_badges db
WHERE NOT EXISTS (
  SELECT 1
  FROM signatures.signature_assets sa
  WHERE sa.account_id = db.account_id
    AND sa.kind = 'award_badge'
    AND sa.scope = 'department'
    AND sa.department = db.department
    AND sa.image_url = db.award_badge_url
);

NOTIFY pgrst, 'reload schema';
