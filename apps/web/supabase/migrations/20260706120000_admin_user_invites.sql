-- Super-admin user invites with pre-configured access before signup.

CREATE TABLE IF NOT EXISTS public.admin_user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invite_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  access_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_user_invites IS
  'Super-admin invitations with pre-configured workspace access applied on first sign-in.';

CREATE INDEX IF NOT EXISTS ix_admin_user_invites_email
  ON public.admin_user_invites (lower(email));

CREATE INDEX IF NOT EXISTS ix_admin_user_invites_status
  ON public.admin_user_invites (status, expires_at DESC);

CREATE INDEX IF NOT EXISTS ix_admin_user_invites_token
  ON public.admin_user_invites (invite_token);

ALTER TABLE public.admin_user_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_user_invites FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.admin_user_invites TO service_role;
GRANT SELECT ON public.admin_user_invites TO authenticated;

DROP POLICY IF EXISTS super_admins_read_admin_user_invites ON public.admin_user_invites;
CREATE POLICY super_admins_read_admin_user_invites
  ON public.admin_user_invites
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP TRIGGER IF EXISTS admin_user_invites_set_timestamps ON public.admin_user_invites;
CREATE TRIGGER admin_user_invites_set_timestamps
  BEFORE UPDATE ON public.admin_user_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();
