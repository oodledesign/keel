-- Client portal invites: pending access for CRM contacts → client_members on accept.
-- Does not grant team account membership (not a seat).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.client_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.client_orgs (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role = ANY (ARRAY['owner'::text, 'member'::text, 'viewer'::text])),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  invite_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT client_portal_invites_token_unique UNIQUE (invite_token),
  CONSTRAINT client_portal_invites_org_email_unique UNIQUE (client_org_id, invited_email)
);

COMMENT ON TABLE public.client_portal_invites IS
  'Pending / accepted invitations for contacts to access /portal/{client_org.slug} via client_members.';

CREATE INDEX IF NOT EXISTS ix_client_portal_invites_account_client
  ON public.client_portal_invites (account_id, client_id);

CREATE INDEX IF NOT EXISTS ix_client_portal_invites_contact
  ON public.client_portal_invites (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_client_portal_invites_user_accepted
  ON public.client_portal_invites (user_id)
  WHERE status = 'accepted' AND user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.client_portal_invites_normalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.invited_email := lower(trim(NEW.invited_email));

  IF NEW.invite_token IS NULL OR length(trim(NEW.invite_token)) = 0 THEN
    NEW.invite_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_portal_invites_normalize ON public.client_portal_invites;
CREATE TRIGGER client_portal_invites_normalize
  BEFORE INSERT OR UPDATE OF invited_email ON public.client_portal_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.client_portal_invites_normalize();

ALTER TABLE public.client_portal_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.client_portal_invites FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.client_portal_invites TO authenticated;
GRANT ALL ON public.client_portal_invites TO service_role;

DROP POLICY IF EXISTS client_portal_invites_select ON public.client_portal_invites;
CREATE POLICY client_portal_invites_select
  ON public.client_portal_invites
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_on_account(account_id)
    OR (user_id IS NOT NULL AND user_id = (SELECT auth.uid()))
    OR lower(invited_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
  );

DROP POLICY IF EXISTS client_portal_invites_insert ON public.client_portal_invites;
CREATE POLICY client_portal_invites_insert
  ON public.client_portal_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'clients.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  );

DROP POLICY IF EXISTS client_portal_invites_update ON public.client_portal_invites;
CREATE POLICY client_portal_invites_update
  ON public.client_portal_invites
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'clients.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  )
  WITH CHECK (
    public.has_permission(
      (SELECT auth.uid()),
      account_id,
      'clients.edit'::public.app_permissions
    )
    AND NOT public.is_contractor_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
  );

-- client_members writes use the service role in app code (existing pattern).

NOTIFY pgrst, 'reload schema';