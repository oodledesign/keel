-- Workspace branches for brand settings and signature contact fallbacks.

CREATE TABLE IF NOT EXISTS public.account_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_branches_name_unique UNIQUE (account_id, name)
);

CREATE INDEX IF NOT EXISTS account_branches_account_id_idx
  ON public.account_branches (account_id);

COMMENT ON TABLE public.account_branches IS
  'Office/branch locations for a workspace — used in email signatures for address, phone, and email fallbacks.';

DROP TRIGGER IF EXISTS account_branches_set_timestamps ON public.account_branches;
CREATE TRIGGER account_branches_set_timestamps
  BEFORE UPDATE ON public.account_branches
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.account_branches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_branches TO authenticated, service_role;

DROP POLICY IF EXISTS account_branches_select ON public.account_branches;
CREATE POLICY account_branches_select ON public.account_branches
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS account_branches_insert ON public.account_branches;
CREATE POLICY account_branches_insert ON public.account_branches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_branches.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_branches_update ON public.account_branches;
CREATE POLICY account_branches_update ON public.account_branches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_branches.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_branches.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_branches_delete ON public.account_branches;
CREATE POLICY account_branches_delete ON public.account_branches
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_branches.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

ALTER TABLE signatures.staff
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.account_branches (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_email text;

CREATE INDEX IF NOT EXISTS signatures_staff_branch_id_idx
  ON signatures.staff (branch_id);
